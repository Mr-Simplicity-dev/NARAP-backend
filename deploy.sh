#!/bin/bash

# NARAP Backend Deployment Script

echo "🚀 Starting NARAP Backend Deployment..."

# Check if .env file exists
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found!"
    echo "Please copy env.example to .env and configure your environment variables."
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Check if installation was successful
if [ $? -ne 0 ]; then
    echo "❌ Error: Failed to install dependencies!"
    exit 1
fi

# Run database cleanup (optional)
echo "🧹 Running database cleanup..."
node -e "
const mongoose = require('mongoose');
require('dotenv').config();

async function cleanup() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Database connected for cleanup');
        
        // Add any cleanup logic here
        
        await mongoose.disconnect();
        console.log('✅ Cleanup completed');
    } catch (error) {
        console.error('❌ Cleanup failed:', error);
        process.exit(1);
    }
}

cleanup();
"

# Start the server
echo "🚀 Starting the server..."
npm start 