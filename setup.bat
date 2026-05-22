@echo off
setlocal
title Recruiter Automation - Setup

echo ========================================
echo   RECRUITER AUTOMATION SYSTEM SETUP
echo ========================================
echo.

:: Check for Node.js
echo [1/3] Checking for Node.js...
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo.
    echo ERROR: Node.js is not installed!
    echo Please install Node.js from https://nodejs.org/ (Download the 'LTS' version)
    echo and then run this setup again.
    pause
    exit /b
)
node -v
echo.

:: Install Dependencies
echo [2/3] Installing software components (this may take a minute)...
call npm install
if %errorlevel% neq 0 (
    echo.
    echo ERROR: Failed to install components. 
    echo Please check your internet connection and try again.
    pause
    exit /b
)
echo.

:: Install Playwright Browsers
echo [3/3] Setting up automated browsers...
call npx playwright install chromium
if %errorlevel% neq 0 (
    echo.
    echo ERROR: Failed to setup browsers.
    pause
    exit /b
)
echo.

echo ========================================
echo   SETUP COMPLETE! 
echo   You can now use 'start_automation.bat'
echo ========================================
echo.
pause
