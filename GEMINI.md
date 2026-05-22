# Project Recruiter Automation - Phase 3 (Indeed & Reliability)

## Overview
This project automates the resume update process for candidates across multiple job boards. Phase 3 adds Indeed.com support and introduces a robust logging/error handling framework.

## Architecture Improvements (Phase 3)

### 1. Reliability & Logging Framework
- **Centralized Logger**: `src/logger.ts` provides structured logging with timestamps and service tags.
- **Auto-Screenshots**: Every service (Dice, Monster, Indeed) now automatically captures a full-page screenshot on failure, saved to `automation_reports/screenshots/`.
- **Resilient Excel**: `src/excelHandler.ts` now includes retry logic for result writing, preventing crashes if the Excel file is locked by the user.
- **Service Isolation**: The orchestrator in `src/index.ts` processes each platform independently. A failure on Dice will no longer prevent updates for Monster or Indeed.

### 2. Indeed.com Integration
- **Indeed Service**: `src/indeedService.ts` handles Indeed-specific login (including Google Auth) and resume upload flows.
- **Persistence**: Uses persistent Chrome profiles per candidate to maintain sessions and reduce login friction.

### 3. Expanded Excel Schema
- The `data.xlsx` file uses an 8-column structure:
  - `A: Name`, `B: Dice Email`, `C: Dice Password`, `D: Monster Email`, `E: Monster Password`, `F: Indeed Email`, `G: Indeed Password`, `H: Resume Filename`.

## Key Files
- `src/index.ts`: Main orchestration logic with service isolation.
- `src/logger.ts`: Centralized logging and screenshot utility.
- `src/diceService.ts`, `src/monsterService.ts`, `src/indeedService.ts`: Platform-specific automation.

## Monitoring
- **Logs**: Check `automation_reports/automation.log` for a full audit trail of the bot's actions.
- **Screenshots**: View `automation_reports/screenshots/` for visual evidence of any failures.
- **Results**: `data/automation_results.xlsx` contains the final status for each candidate/platform.

## Usage
1. Update `data.xlsx` with candidate credentials.
2. Place resumes in `resumes/`.
3. Run the automation: `npm start`
