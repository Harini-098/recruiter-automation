# Recruiter Automation Guide - Phase 2 (Dice & Monster)

This document provides a comprehensive overview of the project, including the implementation journey, new enhancements (Add-ups), and the final automated workflow.

## 1. Project Evolution (What we have done)

### Phase 1: Dice.com Foundation
- Developed a stable automation for Dice.com using Playwright.
- Implemented resume refresh logic (downloading existing resume if no local file is provided).
- Created the Excel handler for reading credentials and logging results.

### Phase 2: Monster.com & Refinement
- **Monster.com Integration**: Added full support for Monster's resume upload flow.
- **Workflow Streamlining**: Refactored the entire system to follow a clean, step-by-step console output.
- **Bot Detection Mitigation**: Implemented stealth measures to handle aggressive security filters on Monster.com.
- **Surgical Code Cleanup**: Removed unnecessary logs and redundant logic for a more efficient execution.

---

## 2. The "Add-Ups" (New Enhancements)

- **Stealth Browser Initialization**: In MonsterService, we now inject scripts to hide the `navigator.webdriver` flag, making the automated browser appear "human" to security filters like Cloudflare and Akamai.
- **Robust Skill Parsing**: Refined the Dice "Parse Skills" logic to handle the "Yes" dialog more reliably using filtered locators.
- **Granular Error Reporting**: The system now distinguishes between "Account not exists" and "Bot Detection Block," providing specific reasons for failure.
- **Simplified Orchestration**: `src/index.ts` was rewritten to open and close browsers strictly as requested, reducing resource overhead and clutter.
- **Defensive Cell Reading**: `src/excelHandler.ts` was updated to handle hyperlinks and rich text in Excel, preventing the common `[object Object]` error.

---

## 3. How to Implement (Setup)

### Prerequisites
- **Node.js**: Ensure Node.js (v18+) is installed.
- **Browsers**: Install Playwright browsers:
  ```bash
  npx playwright install chromium
  ```

### Installation
1. Clone the repository.
2. Install dependencies:
   ```bash
   npm install
   ```

### Configuration
1. **Prepare Resumes**: Place all candidate resumes (PDF/DOCX) in the `resumes/` folder.
2. **Setup Data**: Fill `data.xlsx` with candidate credentials:
   - **Column A**: Name
   - **Column B**: Dice Email
   - **Column C**: Dice Password
   - **Column D**: Monster Email
   - **Column E**: Monster Password
   - **Column F**: Resume Filename (must match the file in `/resumes`)

---

## 4. Implementation Workflow (How it runs)

The system operates on a **Sequential Candidate-First** logic. For every candidate in the Excel sheet, it executes the following steps:

### Step 1: Dice.com Automation
1. **Init**: Opens the Dice browser (`dice browser open`).
2. **Login**: Navigates to Dice and enters credentials (`enter email, password`).
3. **Resume Update**: 
   - Navigates to the profile.
   - Selects the resume file (`update the resume`).
   - Clicks "Yes" on the skill parsing dialog if it appears (`parse-"yes"`).
4. **Finalize**: Confirms update (`updated profile`) and closes the browser (`close browser`).

### Step 2: Transition
- Small human-like jitter delay between platforms to reduce detection risk.

### Step 3: Monster.com Automation
1. **Init**: Opens the Monster browser with stealth flags (`open monster.com`).
2. **Security Check**: Immediately checks if the page is blocked by bot detection.
3. **Login**: Enters credentials (`enter email, password`). If the account is not found, it logs `account not exists`.
4. **Resume Update**: 
   - Navigates to the profile.
   - Uploads the resume and handles "Overwrite" prompts (`login and update the resume`).
5. **Close**: Closes the browser and moves to the next candidate.

### Step 4: Results Logging
- After each attempt (Success or Failure), the result is written to `automation_results.xlsx` with a timestamp and a specific message.

---

## 6. Overcoming Technical Challenges (Manager's Brief)

During Phase 2, we encountered significant resistance from Monster.com's security layers (Cloudflare/Akamai). Here is how we engineered around those challenges:

### 1. Bypassing "Access Restricted" & Bot Detection
Monster.com aggressively blocks automated sessions. We implemented a **Stealth & Masking Layer**:
- **Automation Flag Neutralization**: We used `--disable-blink-features=AutomationControlled` and injected custom scripts to force `navigator.webdriver` to `undefined`. This prevents the website from identifying the browser as a bot.
- **Fingerprint Masking**: We mocked the `window.chrome` object and injected realistic browser plugins/languages. This ensures the automated environment is indistinguishable from a real user's Chrome browser.
- **Identity Rotation**: We configured high-reputation User-Agent strings and matched the browser's Timezone/Locale to the user's region to avoid "mismatch" flags.

### 2. Human-in-the-Loop CAPTCHA Handling
When security sliders ("Slide right to secure your access") appear, standard scripts usually crash. 
- **The Solution**: We implemented a **Detection & Pause Loop**. The automation detects the verification page and pauses, allowing a human to solve the slider in the browser window. Once solved, the script automatically resumes and completes the login.

### 3. Solving the Monster "My Resume" Wizard
Monster's resume update is not a simple file upload; it is a multi-step wizard.
- **Challenge**: Redirection after login often leads back to the home page instead of the profile.
- **The Solution**: We implemented **Specific Navigation Anchors**. The script identifies the profile detail link via `data-testid` and navigates through the granular "Edit -> Set File -> Upload This Document -> Just Upload" sequence. This ensures the "Overwrite Profile" logic is properly triggered and saved.

### 4. Excel Data Integrity
Handling diverse resume paths and candidate data often results in formatting errors.
- **The Solution**: Implemented **Defensive Cell Extraction** in `excelHandler.ts`. This allows the system to read Column F (Resume Filename) regardless of whether it contains plain text, hyperlinks, or rich-text formatting, ensuring the file path is always valid.

---

## 7. Execution Command
To start the automation, run:
```bash
npm start
```
Check the console for real-time status and `automation_results.xlsx` for the final report.
