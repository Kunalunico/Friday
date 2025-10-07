import os
import requests
from dotenv import load_dotenv

load_dotenv()

SLACK_USER_OAUTH_TOKEN = os.getenv("SLACK_USER_OAUTH_TOKEN")
SLACK_API_URL = "https://slack.com/api/"

def send_message_to_slack(message: str, user_id: str):
    """Send a message to a Slack user or channel."""
    headers = {
        "Authorization": f"Bearer {SLACK_USER_OAUTH_TOKEN}",
        "Content-Type": "application/json",
    }
    payload = {"channel": user_id, "text": message}
    response = requests.post(f"{SLACK_API_URL}chat.postMessage", headers=headers, json=payload)
    if response.status_code != 200:
        raise Exception(f"Slack API Error: {response.text}")
