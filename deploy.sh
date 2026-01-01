#!/bin/bash

# PRODUCTION DEPLOYMENT SCRIPT
# Builds images and updates the Swarm stack

echo "🚀 Starting Deployment..."

# 1. Build Backend
echo "📦 Building Backend..."
docker build -t ministerra-backend:latest -f backend/Dockerfile .

# 2. Build Frontend
echo "📦 Building Frontend..."
docker build -t ministerra-frontend:latest frontend/

# 3. Deploy Stack
echo "🚀 Deploying Stack..."
docker stack deploy -c backend/docker-compose.stack.yml ministerra

echo "✅ Deployment Complete!"
docker service ls

