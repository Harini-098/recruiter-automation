@echo off
setlocal
title Recruiter Automation - Run

echo ========================================
echo   STARTING RECRUITER AUTOMATION
echo ========================================
echo.
echo Please ensure 'data/data.xlsx' is filled and resumes are in the 'resumes' folder.
echo Close 'data.xlsx' before starting to avoid errors.
echo.
pause

echo Running automation...
call npm start

echo.
echo ========================================
echo   PROCESS FINISHED
echo ========================================
echo Check the 'automation_reports' folder for logs and screenshots.
echo.
pause
