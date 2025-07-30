@echo off
REM NARAP Backend Deployment Script for Windows

echo 🚀 Starting NARAP Backend Deployment...

REM Check if .env file exists
if not exist .env (
    echo ❌ Error: .env file not found!
    echo Please copy env.example to .env and configure your environment variables.
    pause
    exit /b 1
)

REM Install dependencies
echo 📦 Installing dependencies...
call npm install

REM Check if installation was successful
if %errorlevel% neq 0 (
    echo ❌ Error: Failed to install dependencies!
    pause
    exit /b 1
)

REM Run database cleanup (optional)
echo 🧹 Running database cleanup...
node -e "const mongoose = require('mongoose'); require('dotenv').config(); async function cleanup() { try { await mongoose.connect(process.env.MONGO_URI); console.log('✅ Database connected for cleanup'); await mongoose.disconnect(); console.log('✅ Cleanup completed'); } catch (error) { console.error('❌ Cleanup failed:', error); process.exit(1); } } cleanup();"

REM Start the server
echo 🚀 Starting the server...
call npm start

pause 