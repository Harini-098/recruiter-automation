@echo off
setlocal
title Recruiter Automation - Results

echo Opening Results Excel file...
start "" "data/automation_results.xlsx"

if %errorlevel% neq 0 (
    echo.
    echo ERROR: Could not find 'data/automation_results.xlsx'.
    echo Has the automation been run yet?
    echo.
    pause
)
