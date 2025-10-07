#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting project setup...${NC}"

# Check if poetry is installed
if ! command -v poetry &> /dev/null; then
    echo -e "${RED}Error: Poetry is not installed or not in PATH${NC}"
    exit 1
fi

# Get the poetry environment path
echo -e "${YELLOW}Getting poetry environment path...${NC}"
ENV_PATH=$(poetry env info --path 2>/dev/null)

# Check if poetry env info command was successful
if [ $? -ne 0 ]; then
    echo -e "${RED}Error: Could not get poetry environment info${NC}"
    echo -e "${YELLOW}Make sure you're in a poetry project directory${NC}"
    exit 1
fi

# Check if environment path exists
if [ -z "$ENV_PATH" ]; then
    echo -e "${RED}Error: Poetry environment path is empty${NC}"
    exit 1
fi

echo -e "${GREEN}Environment path: $ENV_PATH${NC}"

# Check if the activation script exists
ACTIVATE_SCRIPT="$ENV_PATH/bin/activate"
if [ ! -f "$ACTIVATE_SCRIPT" ]; then
    echo -e "${RED}Error: Activation script not found at $ACTIVATE_SCRIPT${NC}"
    exit 1
fi

# Check if redis-server is installed
if ! command -v redis-server &> /dev/null; then
    echo -e "${RED}Error: redis-server is not installed or not in PATH${NC}"
    exit 1
fi

# Function to cleanup processes on script exit
cleanup() {
    echo -e "\n${YELLOW}Shutting down services...${NC}"
    if [ ! -z "$REDIS_PID" ]; then
        echo -e "${YELLOW}Stopping Redis server (PID: $REDIS_PID)...${NC}"
        kill $REDIS_PID 2>/dev/null
    fi
    if [ ! -z "$UVICORN_PID" ]; then
        echo -e "${YELLOW}Stopping Uvicorn server (PID: $UVICORN_PID)...${NC}"
        kill $UVICORN_PID 2>/dev/null
    fi
    echo -e "${GREEN}Cleanup completed${NC}"
    exit 0
}

# Set trap to cleanup on script exit
trap cleanup SIGINT SIGTERM EXIT

# Start Redis server in background
echo -e "${YELLOW}Starting Redis server...${NC}"
redis-server --daemonize yes --logfile redis.log --loglevel notice
sleep 2

# Get Redis PID for cleanup
REDIS_PID=$(pgrep redis-server)
if [ ! -z "$REDIS_PID" ]; then
    echo -e "${GREEN}Redis server started (PID: $REDIS_PID)${NC}"
else
    echo -e "${RED}Warning: Could not determine Redis PID${NC}"
fi

# Activate the environment and run the project
echo -e "${YELLOW}Activating environment and starting the project...${NC}"
echo -e "${GREEN}Running: uvicorn ai_agent.api:app --reload${NC}"

# Source the environment and run the command in background
source "$ACTIVATE_SCRIPT" && "$ENV_PATH/bin/uvicorn" ai_agent.api:app --reload &
UVICORN_PID=$!

echo -e "${GREEN}Uvicorn server started (PID: $UVICORN_PID)${NC}"
echo -e "${GREEN}Both services are running. Press Ctrl+C to stop all services.${NC}"

# Wait for the uvicorn process to finish
wait $UVICORN_PID