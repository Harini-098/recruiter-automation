# Project Recruiter Automation - Phase 3 (Indeed & Reliability)

## Overview
This project automates the resume update process for candidates across multiple job boards. Phase 3 adds Indeed.com support and introduces a robust logging/error handling framework.

## Tech Stack
- **Runtime**: Node.js (v18+)
- **Language**: TypeScript (using `tsx` for execution)
- **Automation**: Playwright (with stealth configurations for Monster)
- **Data Handling**: ExcelJS (for `data.xlsx` and `automation_results.xlsx`)
- **Logging**: Custom Winston-based logger in `src/logger.ts`

## Technical Setup & Execution

### 1. Prerequisites
- **Node.js**: Version 18 or higher.
- **Chrome/Edge**: Browsers must be installed on the system.
- **Playwright Browsers**:
  ```bash
  npx playwright install chromium
  ```

### 2. Installation
- **Automated**: Double-click `setup.bat`.
- **Manual**:
  ```bash
  npm install
  npx playwright install chromium
  ```

### 3. Configuration
- **Data Source**: `data/data.xlsx`
  - **Schema (8 Columns)**:
    - `A: Name`
    - `B: Dice Email`, `C: Dice Password`
    - `D: Monster Email`, `E: Monster Password`
    - `F: Indeed Email`, `G: Indeed Password`
    - `H: Resume Filename` (Must match a file in `/resumes`)
- **Resumes**: Place all candidate resumes in the `resumes/` folder.

### 4. Running the Automation
- **Main Entry Point**: `npm start` (runs `src/index.ts` via `tsx`).
- **Batch Scripts**:
  - `start_automation.bat`: Launches the full update cycle.
  - `view_results.bat`: Opens the results spreadsheet.

## Architecture Improvements (Phase 3)

### 1. Reliability & Logging Framework
- **Centralized Logger**: `src/logger.ts` provides structured logging with timestamps and service tags.
- **Auto-Screenshots**: Every service (Dice, Monster, Indeed) now automatically captures a full-page screenshot on failure, saved to `automation_reports/screenshots/`.
- **Resilient Excel**: `src/excelHandler.ts` now includes retry logic for result writing, preventing crashes if the Excel file is locked by the user.
- **Service Isolation**: The orchestrator in `src/index.ts` processes each platform independently. A failure on Dice will no longer prevent updates for Monster or Indeed.

### 2. Indeed.com Integration
- **Indeed Service**: `src/indeedService.ts` handles Indeed-specific login (including Google Auth) and resume upload flows.
- **Persistence**: Uses persistent Chrome profiles per candidate in `temp_chrome_profiles/` to maintain sessions and reduce login friction.

### 3. Monster.com Stealth & Challenges
- **Stealth Mode**: Uses custom scripts to hide `navigator.webdriver` and mask browser fingerprints to bypass Cloudflare/Akamai detection.
- **Human-in-the-Loop**: If a security slider/CAPTCHA appears, the automation pauses to allow a human to solve it before resuming.

## Monitoring
- **Logs**: Check `automation_reports/` for `session_XXXX.log` files.
- **Screenshots**: View `automation_reports/screenshots/` for visual evidence of failures.
- **Results**: `data/automation_results.xlsx` contains the final status for each candidate/platform.
