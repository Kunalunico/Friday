import os
import io
import wave
import shutil
import tempfile
import zipfile
import subprocess
from loguru import logger
import logging
from typing import Optional, List, Dict
import datetime
import httpx
import asyncio
import json
import base64
from fastapi.websockets import WebSocket, WebSocketDisconnect
from cachetools import TTLCache, cached
from crawl4ai import AsyncWebCrawler
from crawl4ai.async_configs import BrowserConfig, CacheMode, CrawlerRunConfig
from dotenv import load_dotenv
from fastapi import (
    Depends,
    FastAPI,
    File,
    Form,
    HTTPException,
    Request,
    UploadFile,
    status,
    BackgroundTasks
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse, StreamingResponse
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
import openai
from pydantic import BaseModel
import redis
from sarvamai import SarvamAI
from sarvamai.play import save
from starlette.middleware.sessions import SessionMiddleware
from langdetect import detect
from langdetect.lang_detect_exception import LangDetectException
from typing import Optional
import uuid
import requests
from ai_agent.audio_transcriber import transcribe_audio
from ai_agent.main import AIAssistant
from ai_agent.slack_integration import send_message_to_slack
from concurrent.futures import ThreadPoolExecutor
import time

# ============================================================================
# RAG IMPORTS AND DEPENDENCIES - Optimized for Performance
# ============================================================================
import fitz  # PyMuPDF
from PIL import Image
from markitdown import MarkItDown
from langchain.text_splitter import RecursiveCharacterTextSplitter

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

load_dotenv()

# ============================================================================
# PERFORMANCE OPTIMIZATIONS - New Configuration
# ============================================================================
# Connection pooling and HTTP optimization
HTTPX_LIMITS = httpx.Limits(max_keepalive_connections=20, max_connections=100)
HTTPX_TIMEOUT = httpx.Timeout(60.0, connect=10.0)

# Thread pool for CPU-bound operations
CPU_EXECUTOR = ThreadPoolExecutor(max_workers=4)

# Async processing flags
ENABLE_BACKGROUND_PROCESSING = True
STREAM_IMMEDIATELY = True

# ============================================================================
# RAG CONFIGURATION - Document Embedding Options (UNCHANGED as requested)
# ============================================================================
# RAG Configuration
RAG_CHUNK_SIZE = 2000                      # Larger chunks
RAG_CHUNK_OVERLAP = 300                    # Better overlap  
MAX_PDF_PAGES = 200                         # LONGER PDF SUPPORT!

# OpenAI Configuration - Optimized client
OPENAI_API_KEY = os.getenv('OPENAI_API_KEY')
if not OPENAI_API_KEY:
    raise ValueError("OPENAI_API_KEY environment variable is not set")

# Initialize OpenAI client with performance optimizations
openai_client = openai.OpenAI(
    api_key=OPENAI_API_KEY,
    max_retries=2,
    timeout=60.0
)

# Manual embedding settings
EMBEDDING_MODEL = "text-embedding-3-large"
ENABLE_MANUAL_EMBEDDINGS = False

# Check OpenAI capabilities with optimized testing
try:
    openai_version = getattr(openai, '__version__', 'unknown')
    print(f"🔧 OpenAI library version: {openai_version}")
    
    # Quick capability check - reduced testing for faster startup
    VECTOR_STORES_AVAILABLE = False
    FILE_SEARCH_AVAILABLE = False
    LEGACY_RETRIEVAL_AVAILABLE = False
    
    # Single optimized test
    try:
        test_assistant = openai_client.beta.assistants.create(
            name="Quick Test Assistant",
            instructions="Test",
            model="gpt-4.1-mini",
            tools=[{"type": "file_search"}]
        )
        openai_client.beta.assistants.delete(test_assistant.id)
        FILE_SEARCH_AVAILABLE = True
        print("✅ File search available")
        
        # Quick vector store test
        try:
            vs_list = openai_client.beta.vector_stores.list(limit=1)
            VECTOR_STORES_AVAILABLE = True
            print("✅ Vector stores available")
        except:
            pass
            
    except Exception as e:
        print(f"⚠️ Limited API access: {e}")
    
except Exception as e:
    print(f"⚠️ OpenAI capabilities check failed: {e}")

# Create directories for RAG
os.makedirs("uploads", exist_ok=True)
os.makedirs("page_images", exist_ok=True)

# Sarvam AI API Configuration
SARVAM_API_BASE_URL = "https://api.sarvam.ai"
SARVAM_STT_ENDPOINT = f"{SARVAM_API_BASE_URL}/speech-to-text"
SARVAM_API_KEY=os.getenv('SARVAM_API_KEY')
if not SARVAM_API_KEY:
    raise ValueError("SARVAM_API_KEY environment variable is not set")

app = FastAPI()

# Allow CORS for frontend development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*", "null", "file://"],
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Add session middleware
app.add_middleware(SessionMiddleware, secret_key=os.getenv("SESSION_SECRET_KEY", "supersecret"))

# ============================================================================
# RAG STATIC FILES SERVING
# ============================================================================
app.mount("/page_images", StaticFiles(directory="page_images"), name="page_images")

assistant = AIAssistant(
    openai_api_key=os.getenv('OPENAI_API_KEY'),
    weather_api_key=os.getenv('WEATHER_API_KEY')
)
client = SarvamAI(api_subscription_key=SARVAM_API_KEY)
SARVAM_STT_URL = "https://api.sarvam.ai/speech-to-text"

# ============================================================================
# RAG MODELS AND STORAGE - Optimized
# ============================================================================
class RAGQueryResponse(BaseModel):
    answer: str
    context_chunks: List[Dict]
    page_images: List[str]
    thread_id: str
    assistant_id: str

# Optimized storage with TTL for cleanup
assistants_store = {}
threads_store = {}
manual_embeddings_store = {}

# Processing status tracking for streaming
processing_status = {}

# ============================================================================
# OPTIMIZED UTILITY FUNCTIONS - High Performance
# ============================================================================

async def extract_page_images_and_text_async(file_path: str, doc_id: str):
    """Async optimized extraction - UNCHANGED processing as requested"""
    def _extract_sync():
        try:
            doc = fitz.open(file_path)
            all_text = ""
            page_images = []
            page_texts = []
            
            max_pages = min(len(doc), MAX_PDF_PAGES)
            
            for page_num in range(max_pages):
                page = doc.load_page(page_num)
                
                # Extract text
                page_text = page.get_text()
                page_texts.append(page_text)
                all_text += page_text + "\n\n"
                
                # Extract page as image - UNCHANGED as requested
                mat = fitz.Matrix(1.5, 1.5)
                pix = page.get_pixmap(matrix=mat)
                img_data = pix.tobytes("png")
                
                # Save page image
                img_filename = f"{doc_id}_page_{page_num + 1}.png"
                img_path = os.path.join("page_images", img_filename)
                
                with open(img_path, "wb") as f:
                    f.write(img_data)
                
                page_images.append(img_filename)
            
            doc.close()
            
            # Text splitting
            splitter = RecursiveCharacterTextSplitter(
                chunk_size=RAG_CHUNK_SIZE,
                chunk_overlap=RAG_CHUNK_OVERLAP,
                separators=["\n\n", "\n", ". ", "! ", "? "]
            )
            chunks = splitter.split_text(all_text)
            
            # Optimized chunk-to-page mapping
            chunk_to_page = []
            for chunk in chunks:
                best_page = 0
                max_ratio = 0
                chunk_words = set(chunk.lower().split())
                
                for i, page_text in enumerate(page_texts):
                    if not page_text.strip():
                        continue
                    page_words = set(page_text.lower().split())
                    if page_words:
                        ratio = len(chunk_words & page_words) / len(chunk_words)
                        if ratio > max_ratio:
                            max_ratio = ratio
                            best_page = i
                
                chunk_to_page.append(best_page)
            
            return chunks, page_images, chunk_to_page, all_text
            
        except Exception as e:
            raise RuntimeError(f"Page extraction failed: {str(e)}")
    
    # Run in thread pool to avoid blocking
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(CPU_EXECUTOR, _extract_sync)

async def process_document_fallback_async(file_path: str, doc_id: str):
    """Async optimized fallback processing"""
    def _process_sync():
        try:
            file_ext = file_path.lower().split('.')[-1]
            
            if file_ext == 'txt':
                with open(file_path, 'r', encoding='utf-8') as f:
                    text_content = f.read()
            else:
                md = MarkItDown()
                text_content = md.convert(file_path).text_content
            
            # Limit text length - UNCHANGED as requested
            if len(text_content) > 50000:
                text_content = text_content[:50000] + "..."
            
            splitter = RecursiveCharacterTextSplitter(
                chunk_size=RAG_CHUNK_SIZE,
                chunk_overlap=RAG_CHUNK_OVERLAP,
                separators=["\n\n", "\n", ". ", "! ", "? "]
            )
            chunks = splitter.split_text(text_content)
            
            if not chunks:
                raise ValueError("No text content extracted")
            
            return chunks, [], [0] * len(chunks), text_content
            
        except Exception as e:
            raise RuntimeError(f"Document processing failed: {str(e)}")
    
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(CPU_EXECUTOR, _process_sync)

async def create_openai_assistant_optimized(document_content: str, filename: str):
    """Highly optimized assistant creation with minimal API calls"""
    try:
        # Create temporary file
        temp_file_path = f"temp_{uuid.uuid4().hex[:8]}_{filename}"
        
        with open(temp_file_path, 'w', encoding='utf-8') as f:
            f.write(document_content)
        
        # Single optimized file upload
        with open(temp_file_path, 'rb') as f:
            file_obj = await asyncio.to_thread(
                openai_client.files.create,
                file=f,
                purpose='assistants'
            )
        
        # Optimized legal instructions (shorter for faster processing)
        legal_instructions = f"""Expert Document Analysis Assistant

You are an expert document analysis assistant specializing in comprehensive document interpretation and professional consultation. You have been provided with a document titled '{filename}' for detailed analysis and questioning.

**DOCUMENT CONTENT:**
{document_content[:60000]}{'...' if len(document_content) > 60000 else ''}

## YOUR EXPERTISE & APPROACH

**Adaptive Analysis**: Adjust your expertise to match the document type (legal, technical, business, academic, etc.) and demonstrate professional-level understanding with:
• **Deep Analysis**: Multi-layered responses exploring explicit content and implicit meanings
• **Contextual Intelligence**: Connect information across document sections for comprehensive insights  
• **Critical Thinking**: Analyze, synthesize, and evaluate rather than simply retrieve information
• **Confidence Clarity**: Distinguish between explicit statements, reasonable inferences, and speculation

## RESPONSE FRAMEWORK

**Standard Structure:**
1. **Direct Answer**: Clear, immediate response to the specific question
2. **Supporting Document**: Cite specific sections with quotes when relevant
3. **Contextual Analysis**: Broader implications and expert interpretation
4. **Limitations**: Note constraints or missing information when applicable

**Citation Standards:**
- Reference specific sections/pages: "According to Section X..." 
- Use direct quotes: "As stated in [location]: '[quote]'"
- When information spans multiple areas, reference all relevant sections
- If information isn't in the document, state this clearly

## QUALITY STANDARDS

**Response Optimization:**
- **Accuracy**: Clearly distinguish document content from your interpretation
- **Completeness**: Address all aspects of complex questions systematically
- **Clarity**: Use professional tone appropriate to document type and context
- **Utility**: Provide actionable insights and expert-level analysis when relevant

**Document Type Adaptations:**
- **Technical**: Focus on specifications, procedures, and technical accuracy
- **Legal**: Emphasize precise language and implications between clauses  
- **Business**: Extract strategic insights, metrics, and operational implications
- **Academic**: Highlight methodology, findings, and scholarly contributions

**Complex Query Handling:**
- Multi-part questions: Address each component systematically
- Ambiguous requests: Provide most likely interpretation while noting assumptions
- Missing context: Work with available content and clearly note limitations
- Contradictory information: Highlight discrepancies and provide analysis

Your goal is to be the definitive expert on this document's content, providing responses that demonstrate comprehensive understanding and professional analytical capability while remaining accessible and actionable."""

        # Single API call for assistant creation
        if VECTOR_STORES_AVAILABLE:
            # Fast vector store method
            assistant, vector_store = await asyncio.gather(
                asyncio.to_thread(
                    openai_client.beta.assistants.create,
                    name=f"Legal Assistant - {filename[:50]}",
                    instructions=legal_instructions,
                    model="gpt-4.1-mini",
                    tools=[{"type": "file_search"}]
                ),
                asyncio.to_thread(
                    openai_client.beta.vector_stores.create,
                    name=f"VS-{filename[:30]}"
                )
            )
            
            # Add file to vector store and update assistant in parallel
            await asyncio.gather(
                asyncio.to_thread(
                    openai_client.beta.vector_stores.files.create,
                    vector_store_id=vector_store.id,
                    file_id=file_obj.id
                ),
                asyncio.to_thread(
                    openai_client.beta.assistants.update,
                    assistant_id=assistant.id,
                    tool_resources={"file_search": {"vector_store_ids": [vector_store.id]}}
                )
            )
            
            method = 'vector_store'
            vector_store_id = vector_store.id
            
        elif FILE_SEARCH_AVAILABLE:
            # Simple file search
            assistant = await asyncio.to_thread(
                openai_client.beta.assistants.create,
                name=f"Legal Assistant - {filename[:50]}",
                instructions=legal_instructions,
                model="gpt-4.1-mini",
                tools=[{"type": "file_search"}]
            )
            method = 'file_search'
            vector_store_id = None
            
        else:
            # Fallback method
            assistant = await asyncio.to_thread(
                openai_client.beta.assistants.create,
                name=f"Legal Assistant - {filename[:50]}",
                instructions=legal_instructions,
                model="gpt-4.1-mini"
            )
            method = 'content_embedding'
            vector_store_id = None
        
        # Store assistant info
        assistant_info = {
            'assistant_id': assistant.id,
            'file_id': file_obj.id,
            'filename': filename,
            'created_at': datetime.datetime.now(),
            'method': method
        }
        
        if vector_store_id:
            assistant_info['vector_store_id'] = vector_store_id
            
        assistants_store[assistant.id] = assistant_info
        
        # Cleanup
        os.remove(temp_file_path)
        
        return assistant.id
        
    except Exception as e:
        if 'temp_file_path' in locals() and os.path.exists(temp_file_path):
            os.remove(temp_file_path)
        raise RuntimeError(f"Assistant creation failed: {str(e)}")

# ============================================================================
# ULTRA-FAST STREAMING IMPLEMENTATIONS
# ============================================================================

async def stream_chat_response_optimized(message: str, google_creds=None, model: str = "gpt-4.1-mini", temperature: float = 0.4):
    """Ultra-optimized streaming chat response"""
    try:
        system_prompt = "You are a helpful AI assistant. Provide clear, accurate responses."
        if google_creds:
            system_prompt += " You have access to Google services."
        
        # Immediate streaming start
        stream = await asyncio.to_thread(
            openai_client.chat.completions.create,
            model=model,
            stream=True,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": message}
            ],
            temperature=temperature
        )
        
        full_answer = ""
        
        for chunk in stream:
            if chunk.choices and len(chunk.choices) > 0:
                delta = chunk.choices[0].delta
                if hasattr(delta, 'content') and delta.content:
                    content = delta.content
                    full_answer += content
                    yield f"data: {json.dumps({'text': content})}\n\n"
        
        yield f"data: {json.dumps({'text': '', 'complete': True, 'full_response': full_answer})}\n\n"
        
    except Exception as e:
        logger.error(f"Streaming error: {str(e)}")
        yield f"data: {json.dumps({'error': str(e), 'complete': True})}\n\n"

async def stream_rag_response_optimized(question: str, assistant_id: str, thread_id: str = None):
    """Ultra-optimized RAG streaming with immediate response"""
    try:
        current_thread_id = thread_id
        
        # Create thread if needed
        if not current_thread_id:
            thread = await asyncio.to_thread(openai_client.beta.threads.create)
            current_thread_id = thread.id
            yield f"data: {json.dumps({'thread_id': current_thread_id, 'text': ''})}\n\n"
        
        # Add message and start streaming immediately
        await asyncio.to_thread(
            openai_client.beta.threads.messages.create,
            thread_id=current_thread_id,
            role="user",
            content=question
        )
        
        # Start streaming run
        with openai_client.beta.threads.runs.stream(
            thread_id=current_thread_id,
            assistant_id=assistant_id
        ) as stream:
            full_response = ""
            
            for event in stream:
                if event.event == 'thread.message.delta':
                    if hasattr(event.data, 'delta') and hasattr(event.data.delta, 'content'):
                        for content_part in event.data.delta.content:
                            if hasattr(content_part, 'text') and hasattr(content_part.text, 'value'):
                                text_delta = content_part.text.value
                                full_response += text_delta
                                yield f"data: {json.dumps({'text': text_delta, 'thread_id': current_thread_id})}\n\n"
                
                elif event.event == 'thread.run.completed':
                    # Store thread info
                    threads_store[current_thread_id] = {
                        'thread_id': current_thread_id,
                        'assistant_id': assistant_id,
                        'created_at': datetime.datetime.now(),
                        'last_question': question,
                        'message_count': 1
                    }
                    yield f"data: {json.dumps({'text': '', 'complete': True, 'thread_id': current_thread_id, 'full_response': full_response})}\n\n"
                    break
                    
                elif event.event == 'thread.run.failed':
                    error_msg = getattr(event.data, 'last_error', 'Run failed')
                    yield f"data: {json.dumps({'error': str(error_msg), 'complete': True, 'thread_id': current_thread_id})}\n\n"
                    break
        
    except Exception as e:
        logger.error(f"RAG streaming error: {str(e)}")
        yield f"data: {json.dumps({'error': str(e), 'complete': True})}\n\n"

# ============================================================================
# BACKGROUND PROCESSING FUNCTIONS
# ============================================================================

async def background_document_processing(file_path: str, doc_id: str, filename: str):
    """Process document in background for better performance"""
    try:
        if filename.lower().endswith('.pdf'):
            chunks, page_images, chunk_to_page, full_text = await extract_page_images_and_text_async(file_path, doc_id)
        else:
            chunks, page_images, chunk_to_page, full_text = await process_document_fallback_async(file_path, doc_id)
        
        # Update processing status
        processing_status[doc_id] = {
            'status': 'completed',
            'chunks': len(chunks),
            'pages': len(page_images),
            'full_text': full_text
        }
        
        return chunks, page_images, chunk_to_page, full_text
        
    except Exception as e:
        processing_status[doc_id] = {
            'status': 'failed',
            'error': str(e)
        }
        raise

async def background_assistant_creation(full_text: str, filename: str, doc_id: str):
    """Create assistant in background"""
    try:
        assistant_id = await create_openai_assistant_optimized(full_text, filename)
        processing_status[doc_id]['assistant_id'] = assistant_id
        return assistant_id
    except Exception as e:
        processing_status[doc_id]['assistant_error'] = str(e)
        raise

# ============================================================================
# ULTRA-FAST STREAMING ENDPOINTS
# ============================================================================

@app.post("/chat/stream")
async def chat_stream_optimized(
    request: Request,
    message: str = Form(...),
    model: str = Form("gpt-4.1-mini"),
    temperature: float = Form(0.4),
    slack_user_id: str = Form(None)
):
    """Ultra-fast streaming chat endpoint"""
    try:
        should_send_to_slack = detect_slack_intent(message)
        ai_input = clean_input_for_ai(message)

        google_creds = None
        try:
            google_creds = get_user_credentials(request)
        except HTTPException:
            pass

        if should_send_to_slack:
            full_response = ""
            async for chunk in stream_chat_response_optimized(ai_input, google_creds, model, temperature):
                try:
                    chunk_data = json.loads(chunk.replace("data: ", "").strip())
                    if chunk_data.get('text'):
                        full_response += chunk_data['text']
                    elif chunk_data.get('complete'):
                        break
                except:
                    continue
            
            slack_id = slack_user_id or os.getenv("DEFAULT_SLACK_USER_ID")
            if slack_id:
                send_message_to_slack(full_response, slack_id)
            
            return JSONResponse({
                "response": full_response, 
                "slack": "sent" if slack_id else "not_sent"
            })
        
        return StreamingResponse(
            stream_chat_response_optimized(ai_input, google_creds, model, temperature),
            media_type="text/plain",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "Content-Type": "text/event-stream",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "*",
                "Access-Control-Allow-Methods": "*"
            }
        )
        
    except Exception as e:
        logger.error(f"Chat stream error: {str(e)}")
        return JSONResponse(status_code=500, content={"error": str(e)})

@app.post("/rag/chat/stream")
async def rag_chat_stream_ultra_fast(
    background_tasks: BackgroundTasks,
    question: str = Form(...),
    file: UploadFile = File(None),
    assistant_id: str = Form(None),
    thread_id: str = Form(None),
    model: str = Form("gpt-4.1")
):
    """
    Ultra-fast RAG streaming with immediate response start
    
    🚀 SPEED OPTIMIZATIONS:
    - Immediate streaming start
    - Background document processing
    - Parallel API calls
    - Optimized assistant creation
    - Minimal latency design
    """
    doc_id = str(uuid.uuid4())[:8]
    
    try:
        print(f"🚀 Ultra-Fast RAG Stream - ID: {doc_id}")
        
        current_assistant_id = assistant_id
        
        # READ FILE CONTENT IMMEDIATELY before streaming starts
        file_content = None
        filename = None
        if file and file.filename:
            try:
                file_content = await file.read()
                filename = file.filename
                print(f"📁 File read successfully: {filename}, size: {len(file_content)} bytes")
                
                if not file_content:
                    raise ValueError("Empty file uploaded")
                    
            except Exception as file_read_error:
                print(f"❌ File read error: {file_read_error}")
                async def file_error_response():
                    yield f"data: {json.dumps({'error': f'Failed to read uploaded file: {str(file_read_error)}', 'complete': True})}\n\n"
                
                return StreamingResponse(
                    file_error_response(),
                    media_type="text/plain",
                    headers={
                        "Cache-Control": "no-cache",
                        "Connection": "keep-alive",
                        "Content-Type": "text/event-stream",
                        "Access-Control-Allow-Origin": "*"
                    }
                )
        
        # NOW start the streaming response with file content safely captured
        async def generate_ultra_fast_response():
            file_path = None
            try:
                # Send immediate acknowledgment
                yield f"data: {json.dumps({'status': 'started', 'doc_id': doc_id, 'text': ''})}\n\n"
                
                # Handle file upload with immediate processing start
                if file_content and filename:
                    yield f"data: {json.dumps({'status': 'processing_file', 'filename': filename, 'text': ''})}\n\n"
                    
                    try:
                        # Save file content to disk
                        file_path = os.path.join("uploads", f"{doc_id}_{filename}")
                        with open(file_path, "wb") as buffer:
                            buffer.write(file_content)
                        
                        # Verify file was saved correctly
                        if not os.path.exists(file_path) or os.path.getsize(file_path) == 0:
                            yield f"data: {json.dumps({'error': 'Failed to save uploaded file to disk', 'complete': True})}\n\n"
                            return
                            
                        yield f"data: {json.dumps({'status': 'file_saved', 'size_bytes': len(file_content), 'text': ''})}\n\n"
                        
                    except Exception as save_error:
                        yield f"data: {json.dumps({'error': f'File save error: {str(save_error)}', 'complete': True})}\n\n"
                        return
                    
                    # Start background processing
                    processing_status[doc_id] = {'status': 'processing'}
                    
                    # Process document in background while preparing response
                    try:
                        yield f"data: {json.dumps({'status': 'starting_document_processing', 'text': ''})}\n\n"
                        
                        doc_task = asyncio.create_task(
                            background_document_processing(file_path, doc_id, filename)
                        )
                        
                        yield f"data: {json.dumps({'status': 'creating_assistant', 'text': ''})}\n\n"
                        
                        # Wait for document processing (optimized)
                        chunks, page_images, chunk_to_page, full_text = await asyncio.wait_for(doc_task, timeout=60.0)
                        
                        yield f"data: {json.dumps({'status': 'document_processed', 'chunks': len(chunks), 'pages': len(page_images), 'text': ''})}\n\n"
                        
                        # Create assistant quickly
                        current_assistant_id = await create_openai_assistant_optimized(full_text, filename)
                        
                        yield f"data: {json.dumps({'assistant_id': current_assistant_id, 'status': 'assistant_ready', 'text': ''})}\n\n"
                        
                    except asyncio.TimeoutError:
                        yield f"data: {json.dumps({'error': 'Document processing timeout (60s) - file may be too large or complex', 'complete': True})}\n\n"
                        return
                    except Exception as processing_error:
                        yield f"data: {json.dumps({'error': f'Processing error: {str(processing_error)}', 'complete': True})}\n\n"
                        return
                
                # Validate assistant
                elif current_assistant_id:
                    if current_assistant_id not in assistants_store:
                        yield f"data: {json.dumps({'error': f'Assistant {current_assistant_id} not found', 'complete': True})}\n\n"
                        return
                    yield f"data: {json.dumps({'status': 'using_existing_assistant', 'assistant_id': current_assistant_id, 'text': ''})}\n\n"
                else:
                    yield f"data: {json.dumps({'error': 'Must provide file or assistant_id', 'complete': True})}\n\n"
                    return
                
                # Start streaming response immediately
                yield f"data: {json.dumps({'status': 'streaming_response', 'text': ''})}\n\n"
                
                # Stream the actual response
                try:
                    async for chunk in stream_rag_response_optimized(question, current_assistant_id, thread_id):
                        yield chunk
                except Exception as stream_error:
                    yield f"data: {json.dumps({'error': f'Streaming error: {str(stream_error)}', 'complete': True})}\n\n"
                    
            except Exception as e:
                logger.error(f"Stream generation error: {str(e)}")
                yield f"data: {json.dumps({'error': f'Stream error: {str(e)}', 'complete': True})}\n\n"
            finally:
                # Cleanup file if it exists
                if file_path and os.path.exists(file_path):
                    try:
                        os.remove(file_path)
                        print(f"✅ Cleaned up file: {file_path}")
                    except Exception as cleanup_error:
                        print(f"⚠️ Cleanup error: {cleanup_error}")
        
        return StreamingResponse(
            generate_ultra_fast_response(),
            media_type="text/plain",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "Content-Type": "text/event-stream",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "*",
                "Access-Control-Allow-Methods": "*"
            }
        )
        
    except Exception as e:
        logger.error(f"Ultra-fast RAG error: {str(e)}")
        
        async def error_response():
            yield f"data: {json.dumps({'error': f'Endpoint error: {str(e)}', 'complete': True})}\n\n"
        
        return StreamingResponse(
            error_response(),
            media_type="text/plain",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "Content-Type": "text/event-stream",
                "Access-Control-Allow-Origin": "*"
            }
        )

# ============================================================================
# PERFORMANCE MONITORING ENDPOINTS
# ============================================================================

@app.get("/rag/performance/status/{doc_id}")
async def get_processing_status(doc_id: str):
    """Get real-time processing status"""
    return processing_status.get(doc_id, {"status": "not_found"})

@app.get("/rag/performance/metrics")
async def get_performance_metrics():
    """Get performance metrics"""
    return {
        "active_assistants": len(assistants_store),
        "active_threads": len(threads_store),
        "processing_jobs": len([s for s in processing_status.values() if s.get('status') == 'processing']),
        "completed_jobs": len([s for s in processing_status.values() if s.get('status') == 'completed']),
        "failed_jobs": len([s for s in processing_status.values() if s.get('status') == 'failed']),
        "vector_stores_available": VECTOR_STORES_AVAILABLE,
        "file_search_available": FILE_SEARCH_AVAILABLE
    }

# ============================================================================
# OPTIMIZED DISCOVERY ENDPOINTS
# ============================================================================

@app.get("/rag/assistants/list")
async def list_all_assistants_fast():
    """Fast assistant listing"""
    try:
        assistants_list = [
            {
                "assistant_id": aid,
                "filename": info.get("filename", "Unknown"),
                "created_at": info.get("created_at", datetime.datetime.now()).isoformat(),
                "method": info.get("method", "unknown"),
                "has_vector_store": "vector_store_id" in info,
                "active_threads": len([t for t in threads_store.values() if t["assistant_id"] == aid])
            }
            for aid, info in assistants_store.items()
        ]
        
        return {
            "success": True,
            "total_assistants": len(assistants_list),
            "assistants": assistants_list,
            "streaming_endpoint": "/rag/chat/stream",
            "performance_tip": "Use existing assistant_id for fastest response times"
        }
        
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.get("/rag/assistants/{assistant_id}/info")
async def get_assistant_info_fast(assistant_id: str):
    """Fast assistant info retrieval"""
    try:
        if assistant_id not in assistants_store:
            raise HTTPException(status_code=404, detail=f"Assistant {assistant_id} not found")
        
        info = assistants_store[assistant_id]
        
        active_threads = [
            {
                "thread_id": tid,
                "created_at": thread_info["created_at"].isoformat(),
                "message_count": thread_info.get("message_count", 0)
            }
            for tid, thread_info in threads_store.items()
            if thread_info["assistant_id"] == assistant_id
        ]
        
        return {
            "success": True,
            "assistant_id": assistant_id,
            "filename": info.get("filename", "Unknown"),
            "method": info.get("method", "unknown"),
            "active_threads": active_threads,
            "streaming_usage": {
                "fast_continue": f"POST /rag/chat/stream with assistant_id={assistant_id} + thread_id",
                "new_chat": f"POST /rag/chat/stream with assistant_id={assistant_id}",
                "performance_tip": "Reuse existing threads for fastest responses"
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.get("/rag/quick-start")
async def rag_quick_start_performance():
    """Performance-optimized quick start guide"""
    return {
        "title": "Ultra-Fast RAG Streaming API",
        "performance_features": [
            "🚀 Immediate streaming start",
            "⚡ Background document processing", 
            "🔄 Parallel API calls",
            "💨 Optimized assistant creation",
            "🎯 Minimal latency design"
        ],
        "fastest_usage": {
            "new_document": {
                "endpoint": "POST /rag/chat/stream",
                "tip": "Streaming starts immediately, processing happens in background",
                "example": "curl -X POST /rag/chat/stream -F question='Analyze this' -F file=@doc.pdf"
            },
            "existing_assistant": {
                "endpoint": "POST /rag/chat/stream",
                "tip": "Fastest response - streams immediately",
                "example": "curl -X POST /rag/chat/stream -F question='Follow up' -F assistant_id=asst_xxx"
            },
            "continue_thread": {
                "endpoint": "POST /rag/chat/stream", 
                "tip": "Lightning fast - uses existing context",
                "example": "curl -X POST /rag/chat/stream -F question='More details' -F assistant_id=asst_xxx -F thread_id=thread_xxx"
            }
        },
        "performance_monitoring": {
            "status_check": "GET /rag/performance/status/{doc_id}",
            "metrics": "GET /rag/performance/metrics"
        }
    }

@app.post("/rag/test/speed")
async def test_streaming_speed():
    """Test streaming speed and latency"""
    try:
        start_time = time.time()
        
        async def speed_test_generator():
            words = ["Testing", "ultra", "fast", "streaming", "response", "with", "minimal", "latency", "optimization"]
            
            for i, word in enumerate(words):
                current_time = time.time()
                latency = (current_time - start_time) * 1000  # ms
                
                yield f"data: {json.dumps({'text': word + ' ', 'word_index': i, 'latency_ms': round(latency, 2)})}\n\n"
                await asyncio.sleep(0.05)  # 50ms delay between words
            
            total_time = (time.time() - start_time) * 1000
            yield f"data: {json.dumps({'text': '', 'complete': True, 'total_latency_ms': round(total_time, 2)})}\n\n"
        
        return StreamingResponse(
            speed_test_generator(),
            media_type="text/plain",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "Content-Type": "text/event-stream",
                "Access-Control-Allow-Origin": "*"
            }
        )
        
    except Exception as e:
        return {"error": str(e)}

# ============================================================================
# ALL EXISTING FUNCTIONALITY PRESERVED BELOW
# ============================================================================

# Keep all your existing models and configurations
class TranscriptionResponse(BaseModel):
    transcript: str
    language_code: str

def process_pdf(pdf_path, output_dir):
    pdf_path = os.path.abspath(pdf_path)
    output_dir = os.path.abspath(output_dir)
    
    if not os.path.exists(pdf_path):
        logger.error(f"PDF file does not exist: {pdf_path}")
        raise Exception("PDF file does not exist.")
    
    if os.path.getsize(pdf_path) > 50 * 1024 * 1024:
        logger.warning("PDF is large (>50MB). Processing may be slow or fail on 8GB RAM.")
    
    if not shutil.which("magic-pdf"):
        logger.error("magic-pdf CLI not found.")
        raise Exception("magic-pdf CLI not found.")
    
    pdf_name = os.path.basename(pdf_path).split(".")[0]
    output_path = os.path.join(output_dir, pdf_name)
    output_image_path = os.path.join(output_path, "images")
    auto_output_path = os.path.join(output_path, "auto")
    auto_image_path = os.path.join(auto_output_path, "images")
    
    try:
        cmd = ["magic-pdf", "-p", pdf_path, "-o", output_dir, "-m", "auto"]
        logger.info(f"Running command: {' '.join(cmd)}")
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        
        logger.info(f"CLI stdout: {result.stdout}")
        logger.info(f"CLI stderr: {result.stderr}")
        
        markdown_file = os.path.join(output_path, f"{pdf_name}.md")
        auto_markdown_file = os.path.join(auto_output_path, f"{pdf_name}.md")
        markdown_content = ""
        
        if os.path.exists(markdown_file):
            logger.info(f"Found Markdown file at: {markdown_file}")
            with open(markdown_file, "r", encoding="utf-8") as f:
                markdown_content = f.read()
        elif os.path.exists(auto_markdown_file):
            logger.info(f"Found Markdown file at: {auto_markdown_file}")
            markdown_file = auto_markdown_file
            with open(markdown_file, "r", encoding="utf-8") as f:
                markdown_content = f.read()
        else:
            logger.warning(f"Markdown file not found at {markdown_file} or {auto_markdown_file}")
            json_file = os.path.join(output_path, f"{pdf_name}.json")
            if os.path.exists(json_file):
                logger.info(f"Found JSON file at: {json_file}. Generating Markdown.")
                with open(json_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                markdown_content = []
                for item in data:
                    if item.get("type") == "text":
                        markdown_content.append(item.get("text", ""))
                    elif item.get("type") == "formula":
                        markdown_content.append(f"$${item.get('text', '')}$$")
                    elif item.get("type") == "image":
                        img_name = item.get("image_name", f"image_{len(markdown_content)}.jpg")
                        markdown_content.append(f"![]({os.path.join('images', img_name)})")
                markdown_content = "\n\n".join(markdown_content)
                with open(markdown_file, "w", encoding="utf-8") as f:
                    f.write(markdown_content)
                logger.info(f"Generated Markdown file at: {markdown_file}")
            else:
                logger.error(f"No JSON file found at: {json_file}")
                raise Exception("No Markdown or JSON file generated.")
        
        image_paths = []
        image_base64 = []
        for img_dir in [output_image_path, auto_image_path]:
            if os.path.exists(img_dir):
                for file in os.listdir(img_dir):
                    if file.endswith((".png", ".jpg", ".jpeg")):
                        img_path = os.path.join(img_dir, file)
                        image_paths.append(img_path)
                        with open(img_path, "rb") as img_file:
                            img_data = base64.b64encode(img_file.read()).decode("utf-8")
                            image_base64.append(f"data:image/{file.split('.')[-1]};base64,{img_data}")
        
        return markdown_file, image_paths, markdown_content, image_base64
    except subprocess.CalledProcessError as e:
        logger.error(f"CLI command failed: {e.stderr}")
        raise Exception(f"CLI error: {e.stderr}")
    except Exception as e:
        logger.error(f"Error processing PDF: {e}")
        raise

# Deep Search Configuration
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
GOOGLE_CSE_ID = os.getenv("GOOGLE_CSE_ID")
# REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
REDIS_URL = os.getenv("REDIS_URL", None)

if not (GOOGLE_API_KEY and GOOGLE_CSE_ID and OPENAI_API_KEY):
    raise RuntimeError("Set GOOGLE_API_KEY, GOOGLE_CSE_ID & OPENAI_API_KEY in .env")

openai.api_key = OPENAI_API_KEY
r = redis.from_url(REDIS_URL, decode_responses=True)

DAILY_LIMIT = 100

def _today_key():
    return f"search_count:{datetime.date.today().isoformat()}"

def incr_and_warn():
    key = _today_key()
    count = r.incr(key)
    if r.ttl(key) == -1:
        tomorrow = datetime.datetime.combine(
            datetime.date.today() + datetime.timedelta(days=1),
            datetime.time.min
        )
        r.expireat(key, int(tomorrow.timestamp()))

    if count > DAILY_LIMIT:
        raise HTTPException(429, "🚫 Daily search limit reached (100). Try again tomorrow.")
    if count == DAILY_LIMIT * 0.9:
        return count, "⚠️ You've reached 90% of your daily quota."
    if count == DAILY_LIMIT * 0.5:
        return count, "⚠️ You've reached 50% of your daily quota."
    return count, None

search_cache = TTLCache(maxsize=256, ttl=300)

@cached(search_cache)
def google_search(q: str, start: int):
    svc = build("customsearch", "v1", developerKey=GOOGLE_API_KEY)
    return svc.cse().list(q=q, cx=GOOGLE_CSE_ID, start=start, num=10).execute()

async def crawl_urls(urls: list[str]):
    browser_cfg = BrowserConfig(browser_type="chromium", headless=True)
    run_cfg = CrawlerRunConfig(
        cache_mode="default",
        wait_for=None,
        screenshot=False,
        pdf=False
    )
    async with AsyncWebCrawler(config=browser_cfg) as crawler:
        return await crawler.arun_many(urls=urls, config=run_cfg)

def llm_summarize(results: list[dict]) -> str:
    chunk = "\n\n".join(
        f"Title: {r['title']}\nSnippet: {r['snippet']}"
        for r in results
    )
    prompt = (
        "You are a professional news editor. Transform the following content into a concise, journalistic summary of 100-120 words. Use present tense where appropriate, focus on key facts first, maintain an objective tone, and include a compelling headline. Format as: HEADLINE followed by the news-style paragraph:\n\n" + chunk
    )
    resp = openai.chat.completions.create(
        model="gpt-4.1-mini",
        messages=[{"role":"user", "content": prompt}],
        max_tokens=200,
        
    )
    return resp.choices[0].message.content.strip()

class Query(BaseModel):
    q: str
    start: int = 1

# Google OAuth Configuration
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
GOOGLE_REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI", "http://localhost:8000/auth/callback")
SCOPES = [
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/gmail.readonly",
    "openid", "email", "profile"
]

def get_google_flow():
    return Flow.from_client_config(
        {
            "web": {
                "client_id": GOOGLE_CLIENT_ID,
                "client_secret": GOOGLE_CLIENT_SECRET,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
                "redirect_uris": [GOOGLE_REDIRECT_URI]
            }
        },
        scopes=SCOPES,
        redirect_uri=GOOGLE_REDIRECT_URI
    )

def get_user_credentials(request: Request):
    creds_data = request.session.get("google_creds")
    if not creds_data:
        raise HTTPException(status_code=401, detail="User not authenticated with Google")
    return Credentials.from_authorized_user_info(creds_data)

# Language Configuration
LANGUAGE_MAPPING = {
    'hi': 'hi-IN', 'en': 'en-IN', 'bn': 'bn-IN', 'gu': 'gu-IN',
    'kn': 'kn-IN', 'ml': 'ml-IN', 'mr': 'mr-IN', 'or': 'or-IN',
    'pa': 'pa-IN', 'ta': 'ta-IN', 'te': 'te-IN', 'ur': 'ur-IN',
}

VALID_SPEAKERS = [
    'meera', 'pavithra', 'maitreyi', 'arvind', 'amol', 'amartya', 
    'diya', 'neel', 'misha', 'vian', 'arjun', 'maya', 'anushka', 
    'abhilash', 'manisha', 'vidya', 'arya', 'karun', 'hitesh'
]

DEFAULT_SPEAKERS = {
    'hi-IN': 'abhilash', 'en-IN': 'anushka', 'bn-IN': 'anushka',
    'gu-IN': 'manisha', 'kn-IN': 'abhilash', 'ml-IN': 'abhilash',
    'mr-IN': 'manisha', 'or-IN': 'abhilash', 'pa-IN': 'abhilash',
    'ta-IN': 'abhilash', 'te-IN': 'anushka', 'ur-IN': 'abhilash',
}

def detect_language(text: str):
    try:
        detected_lang = detect(text)
        if detected_lang in LANGUAGE_MAPPING:
            return LANGUAGE_MAPPING[detected_lang]
        else:
            print(f"Language '{detected_lang}' not supported, defaulting to Hindi")
            return 'hi-IN'
    except LangDetectException:
        print("Language detection failed, defaulting to Hindi")
        return 'hi-IN'

def detect_slack_intent(user_input: str):
    import re
    slack_patterns = [r"(?i)send.*?(to|on|in).*?slack", r"(?i)slack.*?message"]
    return any(re.search(pattern, user_input) for pattern in slack_patterns)

def clean_input_for_ai(user_input: str):
    import re
    return re.sub(r"(?i)send.*?(to|on|in).*?slack", "", user_input).strip()

# ============================================================================
# ALL YOUR EXISTING ENDPOINTS PRESERVED
# ============================================================================

@app.get("/auth/login")
def login(request: Request):
    flow = get_google_flow()
    auth_url, _ = flow.authorization_url(
        prompt='consent',
        access_type='offline',
        include_granted_scopes='true'
    )
    return RedirectResponse(auth_url)

@app.get("/auth/callback")
def auth_callback(request: Request):
    flow = get_google_flow()
    flow.fetch_token(authorization_response=str(request.url))
    creds = flow.credentials
    request.session["google_creds"] = {
        "token": creds.token,
        "refresh_token": creds.refresh_token,
        "token_uri": creds.token_uri,
        "client_id": creds.client_id,
        "client_secret": creds.client_secret,
        "scopes": creds.scopes
    }
    return RedirectResponse("/")

@app.post("/search")
async def deep_search(query: Query):
    if not query.q.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty")
    count, warning = incr_and_warn()

    try:
        cse_resp = google_search(query.q, query.start)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"CSE error: {e}")

    items = cse_resp.get("items", [])
    total = int(cse_resp.get("searchInformation", {}).get("totalResults", 0))

    urls = [it["link"] for it in items]
    try:
        crawl_results = await crawl_urls(urls)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Crawl error: {e}")

    results = []
    for it, cr in zip(items, crawl_results):
        results.append({
            "title": it.get("title"),
            "link": it.get("link"),
            "snippet": it.get("snippet"),
            "thumb": it.get("pagemap", {}).get("cse_thumbnail", [{}])[0].get("src"),
            "success": cr.success,
            "status": cr.status_code,
            "markdown": cr.markdown if cr.success else None,
            "error": cr.error_message if not cr.success else None
        })

    overview = llm_summarize(results)

    return {
        "overview": overview,
        "warning": warning,
        "count": count,
        "limit": DAILY_LIMIT,
        "total": total,
        "items": results
    }

@app.post("/upload_pdf/")
async def upload_pdf(file: UploadFile = File(...)):
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="File must be a PDF.")
    
    with tempfile.TemporaryDirectory() as tmp_dir:
        pdf_path = os.path.join(tmp_dir, file.filename)
        with open(pdf_path, "wb") as f:
            f.write(await file.read())
        
        try:
            markdown_file, image_paths, markdown_content, image_base64 = process_pdf(pdf_path, tmp_dir)
            
            zip_path = os.path.join(tmp_dir, "output.zip")
            with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zipf:
                if os.path.exists(markdown_file):
                    zipf.write(markdown_file, os.path.basename(markdown_file))
                for img in image_paths:
                    zipf.write(img, os.path.relpath(img, tmp_dir))
            
            with open(zip_path, "rb") as f:
                zip_data = base64.b64encode(f.read()).decode("utf-8")
            
            return JSONResponse(content={
                "markdown_content": markdown_content,
                "image_base64": image_base64,
                "image_paths": [os.path.basename(p) for p in image_paths],
                "zip_file": f"data:application/zip;base64,{zip_data}"
            })
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

@app.post("/transcribe", response_model=TranscriptionResponse)
async def transcribe_audio(file: UploadFile = File(...), language_code: str = Form(...)):
    temp_file_path = f"temp_{file.filename}"
    with open(temp_file_path, "wb") as temp_file:
        temp_file.write(await file.read())
    try:
        with open(temp_file_path, "rb") as audio_file:
            files = {"file": (file.filename, audio_file, file.content_type)}
            data = {
                "model": "saarika:v2",
                "language_code": language_code,
                "with_timestamps": "false",
                "with_diarization": "false"
            }
            headers = {"api-subscription-key": SARVAM_API_KEY}
            response = requests.post(SARVAM_STT_URL, files=files, data=data, headers=headers)
            if response.status_code != 200:
                return {"transcript": f"Error: API request failed with status {response.status_code}", "language_code": language_code}
            response_data = response.json()
            transcript = response_data.get("transcript", "No transcription available")
            detected_language = response_data.get("language_code", language_code)
            return {"transcript": transcript, "language_code": detected_language}
    finally:
        if os.path.exists(temp_file_path):
            os.remove(temp_file_path)

@app.post("/text-to-speech/")
async def text_to_speech(
    text: str,
    target_language_code: Optional[str] = None,
    speaker: Optional[str] = None,
    enable_preprocessing: bool = True
):
    try:
        if target_language_code is None:
            target_language_code = detect_language(text)
            print(f"Auto-detected language: {target_language_code}")
        
        if speaker is None:
            speaker = DEFAULT_SPEAKERS.get(target_language_code, 'anushka')
            print(f"Using default speaker: {speaker}")
        
        if speaker not in VALID_SPEAKERS:
            raise HTTPException(
                status_code=400, 
                detail=f"Speaker '{speaker}' is not supported. Valid speakers: {VALID_SPEAKERS}"
            )
        
        if target_language_code not in DEFAULT_SPEAKERS:
            raise HTTPException(
                status_code=400, 
                detail=f"Language code '{target_language_code}' is not supported. Supported languages: {list(DEFAULT_SPEAKERS.keys())}"
            )
        
        response = client.text_to_speech.convert(
            text=text,
            target_language_code=target_language_code,
            speaker=speaker,
            enable_preprocessing=enable_preprocessing,
        )
        
        output_file = f"output_{uuid.uuid4().hex[:8]}.wav"
        save(response, output_file)
        
        return FileResponse(
            output_file,
            media_type="audio/wav",
            filename=f"tts_{target_language_code}_{speaker}.wav",
            headers={
                "X-Detected-Language": target_language_code,
                "X-Speaker-Used": speaker
            }
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/supported-languages/")
async def get_supported_languages():
    return {
        "supported_languages": DEFAULT_SPEAKERS,
        "language_detection_mapping": LANGUAGE_MAPPING,
        "valid_speakers": VALID_SPEAKERS
    }

@app.post("/chat")
async def chat_endpoint(
    request: Request,
    message: str = Form(...),
    slack_user_id: str = Form(None)
):
    try:
        should_send_to_slack = detect_slack_intent(message)
        ai_input = clean_input_for_ai(message)

        google_creds = None
        try:
            google_creds = get_user_credentials(request)
        except HTTPException:
            pass

        response = await assistant.generate_response(
            ai_input,
            google_creds=google_creds
        )

        if should_send_to_slack:
            slack_id = slack_user_id or os.getenv("DEFAULT_SLACK_USER_ID")
            if slack_id:
                send_message_to_slack(response, slack_id)
                return {"response": response, "slack": "sent"}
            else:
                return {"response": response, "slack": "not_sent", "error": "No Slack user ID provided."}
        else:
            return {"response": response}
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})

@app.post("/slack/send")
async def slack_send_endpoint(message: str = Form(...), user_id: str = Form(...)):
    try:
        send_message_to_slack(message, user_id)
        return {"status": "success"}
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})

@app.post("/audio/transcribe")
async def audio_transcribe_endpoint(
    file: UploadFile = File(...),
    model_size: str = Form("base")
):
    try:
        temp_path = f"/tmp/{file.filename}"
        with open(temp_path, "wb") as f:
            f.write(await file.read())
        
        transcription_result = transcribe_audio(temp_path, model_size)
        os.remove(temp_path)
        
        return {
            "transcription": transcription_result["text"],
            "language": transcription_result["language"],
            "language_probability": transcription_result["language_probability"],
            "model_used": model_size
        }
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})

@app.get("/auth/status")
def auth_status(request: Request):
    try:
        creds = get_user_credentials(request)
        return {"authenticated": True}
    except HTTPException:
        return {"authenticated": False}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)