FROM python:3.11-slim

WORKDIR /app

# Install system dependencies INCLUDING portaudio19-dev
RUN apt-get update && apt-get install -y \
    curl \
    build-essential \
    ffmpeg \
    portaudio19-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Poetry
RUN pip install poetry

# Configure Poetry
ENV POETRY_NO_INTERACTION=1 \
    POETRY_VENV_IN_PROJECT=1

# Copy EVERYTHING first
COPY . .

# Install dependencies and whisper, playwright
RUN poetry install && \
    poetry run pip install whisper

RUN poetry run playwright install --with-deps chromium

# Create directories
RUN mkdir -p uploads page_images

# DON'T set PORT - let Cloud Run provide it
# Cloud Run will automatically set PORT environment variable
EXPOSE 8080

# Use the PORT environment variable that Cloud Run provides
CMD ["sh", "-c", "poetry run uvicorn ai_agent.api:app --host 0.0.0.0 --port ${PORT:-8080}"]
