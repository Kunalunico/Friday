import os
import datetime
from typing import List, Tuple, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from cachetools import TTLCache, cached
from dotenv import load_dotenv
from googleapiclient.discovery import build
from crawl4ai import AsyncWebCrawler
from crawl4ai.async_configs import BrowserConfig, CrawlerRunConfig
import openai
import redis

# ─── Load environment ─────────────────────────────────────────────────────────────
load_dotenv()
API_KEY    = os.getenv("GOOGLE_API_KEY")
CSE_ID     = os.getenv("GOOGLE_CSE_ID")
OPENAI_KEY = os.getenv("OPENAI_API_KEY")
# REDIS_URL  = os.getenv("REDIS_URL", "redis://localhost:6379")
REDIS_URL  = os.getenv("REDIS_URL", None)

if not (API_KEY and CSE_ID and OPENAI_KEY):
    raise RuntimeError("Set GOOGLE_API_KEY, GOOGLE_CSE_ID & OPENAI_API_KEY in .env")

openai.api_key = OPENAI_KEY
redis_client = redis.from_url(REDIS_URL, decode_responses=True)

# ─── Quota tracking ───────────────────────────────────────────────────────────────
DAILY_LIMIT = 100

def _today_key() -> str:
    return f"search_count:{datetime.date.today().isoformat()}"

def incr_and_warn() -> Tuple[int, Optional[str]]:
    key = _today_key()
    count = redis_client.incr(key)
    # expire at midnight
    if redis_client.ttl(key) == -1:
        tomorrow = datetime.datetime.combine(
            datetime.date.today() + datetime.timedelta(days=1),
            datetime.time.min
        )
        redis_client.expireat(key, int(tomorrow.timestamp()))

    if count > DAILY_LIMIT:
        raise HTTPException(429, "🚫 Daily search limit reached (100). Try again tomorrow.")
    if count == int(DAILY_LIMIT * 0.9):
        return count, "⚠️ You’ve reached 90% of your daily quota."
    if count == int(DAILY_LIMIT * 0.5):
        return count, "⚠️ You’ve reached 50% of your daily quota."
    return count, None

# ─── Google CSE w/ cache ─────────────────────────────────────────────────────────
search_cache = TTLCache(maxsize=256, ttl=300)

@cached(search_cache)
def google_search(q: str, start: int) -> dict:
    svc = build("customsearch", "v1", developerKey=API_KEY)
    return svc.cse().list(q=q, cx=CSE_ID, start=start, num=5).execute()

# ─── Crawl4AI helper ────────────────────────────────────────────────────────────
async def crawl_urls(urls: List[str]):
    browser_cfg = BrowserConfig(browser_type="chromium", headless=True)
    run_cfg = CrawlerRunConfig(
        cache_mode="default",
        wait_for=None,
        screenshot=False,
        pdf=False
    )
    async with AsyncWebCrawler(config=browser_cfg) as crawler:
        return await crawler.arun_many(urls=urls, config=run_cfg)

# ─── LLM Summarization ──────────────────────────────────────────────────────────
def llm_summarize(results: List[dict]) -> str:
    chunk = "\n\n".join(
        f"Title: {r['title']}\nSnippet: {r['snippet']}"
        for r in results
    )
    prompt = (
        "You are a super‐concise summarizer. "
        "Create a single paragraph overview of these search results:\n\n" + chunk
    )
    resp = openai.chat.completions.create(
        model="gpt-4",
        messages=[{"role":"user", "content": prompt}],
        max_tokens=200
    )
    return resp.choices[0].message.content.strip()

# ─── Request Schema & Router ────────────────────────────────────────────────────
class Query(BaseModel):
    q: str
    start: int = 1

router = APIRouter()

@router.post("/search", summary="Deep web search + summarize")
async def deep_search(query: Query):
    if not query.q.strip():
        raise HTTPException(400, "Query cannot be empty")

    # 1) quota
    count, warning = incr_and_warn()

    # 2) Google CSE
    try:
        cse_resp = google_search(query.q, query.start)
    except Exception as e:
        raise HTTPException(500, f"CSE error: {e}")

    items = cse_resp.get("items", [])
    total = int(cse_resp.get("searchInformation", {}).get("totalResults", 0))

    # 3) Crawl each URL
    urls = [it["link"] for it in items]
    try:
        crawl_results = await crawl_urls(urls)
    except Exception as e:
        raise HTTPException(500, f"Crawl error: {e}")

    # 4) Package results
    results = []
    for it, cr in zip(items, crawl_results):
        results.append({
            "title":   it.get("title"),
            "link":    it.get("link"),
            "snippet": it.get("snippet"),
            "thumb":   it.get("pagemap", {}).get("cse_thumbnail", [{}])[0].get("src"),
            "success": cr.success,
            "status":  cr.status_code,
            "markdown": cr.markdown if cr.success else None,
            "error":   cr.error_message if not cr.success else None
        })

    # 5) Summarize
    overview = llm_summarize(results)

    return {
        "overview": overview,
        "warning":  warning,
        "count":    count,
        "limit":    DAILY_LIMIT,
        "total":    total,
        "items":    results
    }
