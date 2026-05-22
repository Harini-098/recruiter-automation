# Recruiter Automation Tool - User Guide

Welcome! This tool helps you automatically update candidate resumes on **Dice**, **Monster**, and **Indeed**.

---

## 🚀 Quick Start (First Time Only)
Double-click the **`setup.bat`** file. This will prepare your computer to run the automation. You only need to do this once.

---

## 📋 How to Prepare

### 1. The Excel Sheet (`data/data.xlsx`)
Open the `data.xlsx` file in the `data` folder and fill in the candidate details:
- **Column A (Name):** Candidate's Full Name.
- **Columns B-G:** Email and Password for Dice, Monster, and Indeed.
- **Column H (Resume Filename):** The exact name of the file (e.g., `John_Doe_Resume.pdf`).

> **Note:** If you don't have an account for one of the platforms, just leave those email/password columns blank.

### 2. The Resumes Folder (`resumes/`)
Put all the resume files (PDF or Word) into the `resumes` folder. 
**Important:** The name of the file must exactly match what you typed in the Excel sheet (Column H).

---

## ▶️ Running the Automation
1. Close the Excel sheet (`data.xlsx`) if you have it open.
2. Double-click **`start_automation.bat`**.
3. A black window will appear. Press any key to start.
4. The tool will now go through each candidate one by one. You will see progress messages in the window.

---

## 📊 Viewing Results
When the automation finishes:
1. Double-click **`view_results.bat`**.
2. This will open an Excel sheet showing the status (SUCCESS or FAILED) for each candidate and platform.

---

## 🛠️ Troubleshooting
- **Browser won't open:** Run `setup.bat` again.
- **"File Locked" Error:** Make sure you close the Excel files (`data.xlsx` or `automation_results.xlsx`) before running the tool.
- **Screenshots:** If an update fails, look in the `automation_reports/screenshots` folder. You will find a picture of exactly what the tool saw when it failed.
- **Logs:** A detailed record of every run is saved in `automation_reports/session_XXXX.log`.

---
*For technical support, contact the Engineering Team.*
