# Project Recruiter Automation - Phase 2 (Dice & Monster)

## Overview
This project automates the resume update process for candidates across multiple job boards. After the successful implementation of Dice.com (Phase 1), Phase 2 extended the system to support Monster.com and improved data reliability.

## Architecture Improvements (Post-Phase 1)

### 1. Multi-Site Orchestration
- **Entry Point**: `src/index.ts` now iterates through a unified list of candidates and attempts updates on both Dice and Monster sequentially.
- **Independent Execution**: Failures or missing accounts on one platform do not stop the automation for the other. Each site is wrapped in its own `try-catch` block.

### 2. Refactored Excel Handler
- **Unified Schema**: The `data.xlsx` file now uses a expanded structure:
  - `Column A`: Name
  - `Column B`: Dice Email
  - `Column C`: Dice Password
  - `Column D`: Monster Email
  - `Column E`: Monster Password
  - `Column F`: Resume Filename (Local file in `/resumes`)
- **Robust Extraction**: Implemented defensive cell reading in `src/excelHandler.ts` to handle rich text, hyperlinks, and complex objects, preventing `[object Object]` errors.

### 3. Account Detection & Error Handling
- **Specific Messaging**: The system now distinguishes between different failure types:
  - `account not exists or deleted`: Specifically logged when a 404 is hit, or "Account not found" text is detected on the page.
  - `invalid credentials`: Logged when the email is found but the password fails.
- **Automatic Recovery**: If a login fails, the script logs the error to `automation_results.xlsx` and moves to the next platform/candidate.

### 4. Monster.com Service (`src/monsterService.ts`)
- **Resilient Navigation**: Starts from the home page and uses multiple selector patterns to find login fields.
- **Anti-Bot Measures**: Uses realistic User-Agents and human-like wait times to reduce detection.
- **Resume Logic**: Handles the "My Resume" section, file upload, and "Upload and Overwrite" prompts.

## Key Files
- `src/index.ts`: Main orchestration logic.
- `src/diceService.ts`: Dice-specific automation.
- `src/monsterService.ts`: Monster-specific automation.
- `src/excelHandler.ts`: Logic for reading `data.xlsx` and writing `automation_results.xlsx`.

## Current Status & Limitations
- **Dice**: Fully stable. Handles local uploads and "refresh" (download/re-upload) logic.
- **Monster**: Implemented with resilient selectors. Note: Monster has aggressive bot detection; if login fails repeatedly, it may require manual intervention or a stealth proxy.
- **Validation**: Project verified with `npx tsc --noEmit`.

## Usage
1. Update `data.xlsx` with candidate credentials.
2. Place resumes in the `resumes/` folder.
3. Run the automation:
   ```bash
   npm start
   ```
4. Check `automation_results.xlsx` for the status of each account.
