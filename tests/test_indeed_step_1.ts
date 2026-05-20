import { chromium } from "playwright";
import * as path from "path";

async function step1() {
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
        console.log("Step 1: Navigating to Indeed homepage...");
        await page.goto("https://www.indeed.com/", { waitUntil: "load" });
        await page.screenshot({ path: "step1_homepage.png" });

        console.log("Clicking 'Sign in'...");
        // Using a more robust selector based on the guide's HTML
        const signInBtn = page.locator('a[data-gnav-element-name="SignIn"], a:has-text("Sign in")').first();
        await signInBtn.waitFor({ state: "visible", timeout: 15000 });
        await signInBtn.click();

        console.log("Waiting for login page to load...");
        // Instead of networkidle, wait for a specific element from the login page
        const emailHeader = page.locator('h1:has-text("Ready to take the next step?"), h1[data-tn-section="auth-page-header--enter-email"]').first();
        await emailHeader.waitFor({ state: "visible", timeout: 20000 });
        
        console.log("Successfully reached login page!");
        await page.screenshot({ path: "step1_login_page.png" });

    } catch (err: any) {
        console.error("Step 1 failed:", err.message);
        await page.screenshot({ path: "step1_failure.png" });
    } finally {
        await context.close();
    }
}

step1();
