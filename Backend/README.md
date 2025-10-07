# Friday - Intelligent Multi-Service Automation Platform

Friday is an intelligent, voice-enabled AI chatbot system built to handle a wide range of tasks by acting as a digital agent. It doesn't just answer questions — it performs real-world actions across services like Slack, Gmail, Google Calendar, and Weather APIs. It also supports a conversational voice mode for hands-free interaction.

Friday isn't just a chatbot. It's a multi-service automation platform that uses LLMs and API orchestration to bridge the gap between user queries and real-world actions.

## 🚀 Features

### Multi-Service Integrations (Agent Actions)

- **🔗 Slack Integration**
  - Example: "_< question > & Send this to John on Slack_" — Identifies users and message content, triggers Slack API accordingly
  
- **📅 Google Calendar Integration**
  - Example: "_Schedule a meeting with Sarah tomorrow at 4 PM_"
  - Extracts intent and time, creates events, generates Google Meet links, and sends invites via Gmail
  
- **📧 Gmail Integration**
  - Send emails directly via command: "_Email the marketing update to the team_"
  
- **🌤️ Weather Service**
  - Example: "_What's the weather in Tokyo tomorrow?_"
  - Fetches real-time weather updates using third-party weather APIs
  
- **🤖 Generic Q&A Support**
  - Handles factual, contextual, and instructional queries
  - Examples: "_Explain the difference between Kubernetes and Docker_", "_Translate this sentence to French_", "_Summarise this email_"
  
- **📄 QnA with Document (RAG)**
  - Users can attach documents and chat with them using Retrieval-Augmented Generation
  
- **🎤 Speech-to-Text & Text-to-Speech (SST & TTS)**
  - Users can talk in any Indian languages - the system will transcribe it
  - Full TTS support for voice responses
  
- **🔍 Web Search**
  - Users can search for anything and Unico AI will crawl top K websites
  - Summarizes content and provides comprehensive answers

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- **Python 3.8+**
- **Poetry** (Python dependency management tool)
- **Git**

### Installing Poetry

If you don't have Poetry installed, install it using:

```bash
# On macOS/Linux
curl -sSL https://install.python-poetry.org | python3 -

# On Windows (PowerShell)
(Invoke-WebRequest -Uri https://install.python-poetry.org -UseBasicParsing).Content | python -
```

## 🛠️ Installation

### 1. Clone the Repository

```bash
git clone <your-repository-url>
cd agentic-ai
```

### 2. Install Dependencies with Poetry

```bash
# Install all dependencies
poetry install

# Install development dependencies (optional)
poetry install --with dev
```

### 3. Environment Setup

Create a `.env` file in the root directory and configure your API keys:

```bash
cp .env.example .env
```

Edit the `.env` file with your API credentials:

```env
# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key

# Slack Configuration
SLACK_BOT_TOKEN=your_slack_bot_token
SLACK_APP_TOKEN=your_slack_app_token

# Google Services Configuration
GOOGLE_API_KEY=path_to_your_google_API
GOOGLE_CSE_ID=path_to_your_gmail_credentials.json
SARVAM_API_KEY=path_to_your_sarvam_API_key

# Weather API Configuration
WEATHER_API_KEY=your_weather_api_key


### 4. Set up Google API Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the following APIs:
   - Gmail API
   - Google Calendar API
4. Create credentials (OAuth 2.0 Client ID)
5. Download the JSON file and place it in your project directory
6. Update the paths in your `.env` file

## 🚀 Quick Start

### Using the Run Script (Recommended)

We've provided a convenient shell script to start the project:

```bash
# Make the script executable
chmod +x run_project.sh

# Run the project
./run_project.sh
```

### Manual Start

If you prefer to start manually:

```bash
# Get poetry environment path
poetry env info --path

# Activate the environment (replace <path> with the output from above)
source <path>/bin/activate

# Start the application
uvicorn ai_agent.api:app --reload
```

The API will be available at `http://127.0.0.1:8000#docs`

## 🎯 Usage Examples

### Slack Integration
```
User: "What's the status of our project? Send this update to the development team on Slack"
AI: Analyzes the query, prepares a status update, and sends it to the specified Slack channel
```

### Calendar Scheduling
```
User: "Schedule a standup meeting with the team for tomorrow at 9 AM"
AI: Creates a calendar event, generates a Google Meet link, and sends invites to team members
```

### Weather Queries
```
User: "What's the weather like in Mumbai today?"
AI: Fetches current weather data and provides a detailed forecast
```

### Document Q&A
```
User: Uploads a PDF document and asks "What are the key points in this report?"
AI: Processes the document and provides a comprehensive summary
```

## 🧪 Testing

Run the test suite using:

```bash
# Run all tests
poetry run pytest

# Run tests with coverage
poetry run pytest --cov=ai_agent

# Run specific test file
poetry run pytest tests/test_api.py
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

**Built with ❤️ by the Kunal Pohakar**