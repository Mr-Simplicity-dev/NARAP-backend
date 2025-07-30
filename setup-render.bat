@echo off
REM NARAP Backend - Render Setup Script for Windows

echo 🚀 NARAP Backend Render Setup
echo ==============================

REM Check if we're in the backend directory
if not exist "package.json" (
    echo ❌ Error: Please run this script from the backend directory
    pause
    exit /b 1
)

REM Check if .env file exists
if not exist ".env" (
    echo 📝 Creating .env file from template...
    copy env.example .env
    echo ✅ .env file created. Please edit it with your configuration.
    echo.
    echo Required environment variables:
    echo - MONGO_URI: Your MongoDB connection string
    echo - JWT_SECRET: A secure random string for JWT tokens
    echo - FRONTEND_URL: Your frontend URL for CORS
    echo.
    echo Edit .env file and run this script again.
    pause
    exit /b 0
)

REM Install dependencies
echo 📦 Installing dependencies...
call npm install

if %errorlevel% neq 0 (
    echo ❌ Error: Failed to install dependencies
    pause
    exit /b 1
)

echo.
echo 🎉 Backend is ready for Render deployment!
echo.
echo Next steps:
echo 1. Push your code to GitHub
echo 2. Go to render.com and create a new Web Service
echo 3. Connect your GitHub repository
echo 4. Set root directory to 'backend'
echo 5. Configure environment variables in Render dashboard
echo 6. Deploy!
echo.
echo For detailed instructions, see: RENDER_DEPLOYMENT_GUIDE.md
pause 