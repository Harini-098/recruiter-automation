# Dice Automation: TypeScript & Playwright Implementation Guide

This document explains the architecture, dependencies, and steps to build and run the Dice.com Resume Refresh automation.

---

## 1. Project Overview
The goal of this project is to automate the login and resume update process on Dice.com. By re-uploading your resume daily, you maintain a "Recently Updated" status, which significantly increases your visibility to recruiters.

---

## 2. Key Modules & Dependencies

| Module | Purpose |
| :--- | :--- |
| **Playwright** | The core automation engine. It controls the Chromium browser, handles logins, navigation, and file uploads. |
| **ExcelJS** | Used to read candidate credentials (email/password) from `data.xlsx` and write the execution results to `automation_results.xlsx`. |
| **tsx** | A modern TypeScript executor that allows us to run `.ts` files directly without a manual compilation step. |
| **path & fs** | Native Node.js modules for managing file paths and checking if files (like resumes) exist. |

---

## 3. Step-by-Step Implementation

### Phase 1: Environment Setup
1. **Initialization**: Create a Node.js project (`npm init`) and set the type to `"module"` in `package.json` to support modern JavaScript syntax.
2. **TypeScript Configuration**: Set up `tsconfig.json` to use `NodeNext` resolution to ensure compatibility with modern libraries.
3. **Folder Structure**: 
   - `src/`: Source code.
   - `resumes/`: Storage for local PDF/Docx files.
   - `screenshots/`: Storage for verification images.
   - `temp/`: Storage for downloaded resumes during "Auto-Refresh".

### Phase 2: Excel Integration (`src/excelHandler.ts`)
- **Reading**: We use `workbook.xlsx.readFile()` to open `data.xlsx`. We iterate through rows to extract emails and passwords.
- **Writing**: After each run, we append a new row to `automation_results.xlsx` with the status (SUCCESS/FAILED) and the path to the screenshot.

### Phase 3: Browser Automation (`src/diceService.ts`)
1. **Login**: Navigates to the Dice login page, handles the cookie banner, enters email, clicks continue, and then enters the password.
2. **Resume Management**:
   - **Local Upload**: If a filename is specified in Excel, it uploads from the `resumes/` folder.
   - **Download-Refresh**: If no file is specified, it downloads your current resume from Dice and re-uploads it immediately.
3. **Shadow DOM Handling**: Dice uses custom web components. We use specialized Playwright locators to "reach inside" these components to click the **"Yes"** button on the "Parse Resume Skills" dialog.

### Phase 4: Orchestration (`src/index.ts`)
- This is the "brain" of the app. It reads the Excel list and loops through each account, calling the `DiceService` functions in order.

---

## 4. How to Run

### Prerequisites
- [Node.js](https://nodejs.org/) installed.
- Your resume files placed in the `resumes/` folder.

### Setup & Run
1. **Install Dependencies**:
   ```powershell
   npm install
   npx playwright install chromium
   ```
2. **Prepare Data**: Ensure your `data.xlsx` is in the project root with columns:
   `Email | Password | Resume_Filename`
3. **Execute**:
   ```powershell
   npm start
   ```

---

## 5. Why Run This?
- **Search Ranking**: Dice search results prioritize candidates with recent activity. 
- **Efficiency**: Manually updating 5+ accounts takes 20 minutes; this takes 1 minute.
- **Verification**: The system generates an Excel report and screenshots, so you have proof that your profile was actually updated.

---

## 6. Troubleshooting
- **Timeout Errors**: Usually means the internet is slow or Dice changed their layout. Check the `screenshots/` folder to see what the browser was looking at.
- **File Not Found**: Ensure the resume filename in Excel matches the actual file name in the `resumes/` folder exactly.
