#!/bin/bash

# NARAP Backend - Render Setup Script

echo "🚀 NARAP Backend Render Setup"
echo "=============================="

# Check if we're in the backend directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Please run this script from the backend directory"
    exit 1
fi

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "📝 Creating .env file from template..."
    cp env.example .env
    echo "✅ .env file created. Please edit it with your configuration."
    echo ""
    echo "Required environment variables:"
    echo "- MONGO_URI: Your MongoDB connection string"
    echo "- JWT_SECRET: A secure random string for JWT tokens"
    echo "- FRONTEND_URL: Your frontend URL for CORS"
    echo ""
    echo "Edit .env file and run this script again."
    exit 0
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ Error: Failed to install dependencies"
    exit 1
fi

# Test the server locally
echo "🧪 Testing server locally..."
timeout 10s npm start &
SERVER_PID=$!

sleep 5

# Test health endpoint
if curl -s http://localhost:5000/api/health > /dev/null; then
    echo "✅ Server is running locally"
    kill $SERVER_PID 2>/dev/null
else
    echo "❌ Server failed to start locally"
    kill $SERVER_PID 2>/dev/null
    exit 1
fi

echo ""
echo "🎉 Backend is ready for Render deployment!"
echo ""
echo "Next steps:"
echo "1. Push your code to GitHub"
echo "2. Go to render.com and create a new Web Service"
echo "3. Connect your GitHub repository"
echo "4. Set root directory to 'backend'"
echo "5. Configure environment variables in Render dashboard"
echo "6. Deploy!"
echo ""
echo "For detailed instructions, see: RENDER_DEPLOYMENT_GUIDE.md" 