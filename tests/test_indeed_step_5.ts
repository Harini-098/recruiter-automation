import { chromium } from "playwright";
import * as path from "path";
import * as fs from "fs";
import { ExcelHandler } from "../src/excelHandler.js";

async function step5() {
    const baseDir = process.cwd();
    const excelHandler = new ExcelHandler(baseDir);
    const credentials = await excelHandler.readCredentials();
    const creds = credentials[0];

    const resumePath = path.join(baseDir, "resumes", creds.resumeFilename);
    if (!fs.existsSync(resumePath)) {
        console.error(`Resume file not found: ${resumePath}`);
        return;
    }

    const userDataDir = path.join(process.cwd(), 'temp_chrome_profile');
    console.log("Launching browser...");
    const context = await chromium.launchPersistentContext(userDataDir, {
        headless: false,
        slowMo: 1000,
        channel: 'chrome',
        args: ['--disable-blink-features=AutomationControlled']
    });

    const page = context.pages()[0] || await context.newPage();

    try {
        console.log("Navigating to Profile...");
        await page.goto("https://profile.indeed.com/", { waitUntil: "load" });
        await page.waitForTimeout(3000);

        if (!page.url().includes("profile.indeed.com")) {
             console.log("Not on profile page, login might be needed (Skipping login logic for brevity, assuming session is active)");
             return;
        }

        console.log("Opening Resume section...");
        const resumeSection = page.locator('div.css-1e9y1g.e37uo190').first();
        await resumeSection.waitFor({ state: "visible" });
        await resumeSection.click();
        await page.waitForTimeout(2000);

        console.log("Triggering 'Replace file'...");
        const replaceBtn = page.locator('button:has-text("Replace file"), [data-tn-element="replace-menu-btn"]').first();
        await replaceBtn.waitFor({ state: "attached" });
        
        // Use Promise.all to catch the filechooser while clicking
        const [fileChooser] = await Promise.all([
            page.waitForEvent("filechooser"),
            replaceBtn.evaluate((el: HTMLElement) => el.click())
        ]);

        console.log("Uploading file...");
        await fileChooser.setFiles(resumePath);
        await page.waitForTimeout(5000); // Wait for upload

        console.log("Clicking 'Continue'...");
        const continueBtn = page.locator('button:has-text("Continue")').first();
        await continueBtn.waitFor({ state: "visible", timeout: 20000 });
        await continueBtn.click();
        
        console.log("Clicking 'Upload this resume'...");
        const uploadConfirmBtn = page.locator('button:has-text("Upload this resume")').first();
        await uploadConfirmBtn.waitFor({ state: "visible", timeout: 20000 });
        await uploadConfirmBtn.click();
        
        console.log("Clicking 'Save and exit'...");
        const saveExitBtn = page.locator('button[data-tn-element="save-exit"], button:has-text("Save and exit")').first();
        await saveExitBtn.waitFor({ state: "visible", timeout: 20000 });
        await saveExitBtn.click();

        console.log("Step 5 successful! Resume updated and saved.");
        await page.screenshot({ path: "step5_success.png" });

    } catch (err: any) {
        console.error("Step 5 failed:", err.message);
        await page.screenshot({ path: "step5_failure.png" });
    } finally {
        await context.close();
    }
}

step5();
