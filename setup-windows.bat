@echo off
REM BOOM Payment Gateway - Windows Setup Script
REM This script automates the setup process for Windows users

echo.
echo ============================================
echo  BOOM Payment Gateway - Windows Setup
echo ============================================
echo.

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed!
    echo.
    echo Please install Node.js from: https://nodejs.org/
    echo Download the "LTS" version and run the installer.
    echo.
    pause
    exit /b 1
)

echo [INFO] Node.js is installed
node --version

REM Check if npm is available
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] npm is not available!
    echo Please reinstall Node.js from: https://nodejs.org/
    pause
    exit /b 1
)

echo [INFO] npm is available
npm --version

echo.
echo [INFO] Installing dependencies...
npm install
if %errorlevel% neq 0 (
    echo [ERROR] Failed to install dependencies!
    pause
    exit /b 1
)

echo.
echo [INFO] Creating environment configuration...
if not exist .env (
    copy .env.example .env
    echo [INFO] Created .env file with default configuration
) else (
    echo [INFO] .env file already exists
)

echo.
echo [INFO] Creating data directory...
if not exist data mkdir data

echo.
echo [INFO] Setting up database...
npm run migrate
if %errorlevel% neq 0 (
    echo [WARNING] Database migration failed, but continuing...
)

echo.
echo [INFO] Running tests...
npm test
if %errorlevel% neq 0 (
    echo [WARNING] Some tests failed, but continuing...
)

echo.
echo ============================================
echo  Setup Complete!
echo ============================================
echo.
echo Your BOOM Payment Gateway is ready to use!
echo.
echo To start the server:
echo   npm start
echo.
echo Once started, you can access:
echo   Admin Panel: http://localhost:3000/admin
echo   API Base:    http://localhost:3000/api/v1
echo.
echo Default admin credentials:
echo   Email:    admin@boom-payments.com
echo   Password: password
echo.
echo IMPORTANT: Change the default password in production!
echo.
pause