# Project Recruiter Automation - Phase 3 (Indeed Integration)

## Overview
This project automates the resume update process for candidates across multiple job boards. Phase 3 adds support for Indeed.com, expands the data schema, and includes a backup of Phase 2.

## Architecture Improvements (Phase 3)

### 1. Indeed.com Integration
- **Indeed Service**: `src/indeedService.ts` handles Indeed-specific login and resume upload flows.
- **Stealth Measures**: Uses realistic User-Agents and human-like delays to minimize bot detection on Indeed.
- **Persistence**: Implements `storageState` to reuse authentication sessions and reduce login attempts.

### 2. Expanded Excel Schema
- The `data.xlsx` file now uses an 8-column structure:
  - `Column A`: Name
  - `Column B`: Dice Email
  - `Column C`: Dice Password
  - `Column D`: Monster Email
  - `Column E`: Monster Password
  - `Column F`: Indeed Email
  - `Column G`: Indeed Password
  - `Column H`: Resume Filename (Local file in `/resumes`)
- `src/excelHandler.ts` has been updated to support this new mapping.

### 3. Backup Management
- The Phase 2 state has been archived in `backup/phase-2/` for stability and rollback purposes.

### 4. Multi-Site Orchestration
- `src/index.ts` now sequentially processes **Dice -> Monster -> Indeed** for each candidate.

## Key Files
- `src/index.ts`: Main orchestration logic.
- `src/diceService.ts`: Dice-specific automation.
- `src/monsterService.ts`: Monster-specific automation.
- `src/indeedService.ts`: Indeed-specific automation.
- `src/excelHandler.ts`: Logic for reading `data.xlsx` and writing `automation_results.xlsx`.

## Current Status & Limitations
- **Dice**: Fully stable.
- **Monster**: Resilient selectors implemented. Note aggressive bot detection.
- **Indeed**: New implementation. Requires non-headless mode for initial login/CAPTCHA handling if session expires.
- **Validation**: Project verified with `npx tsc --noEmit`.

## Usage
1. Update `data.xlsx` with candidate credentials for all three platforms. **Ensure the Resume Filename is now in Column H.**
2. Place resumes in the `resumes/` folder.
3. Run the automation:
   ```bash
   npm start
   ```
4. Check `automation_results.xlsx` for the status of each account.
