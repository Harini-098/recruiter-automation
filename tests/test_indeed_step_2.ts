import { chromium } from "playwright";
import * as path from "path";

async function step2() {
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
        console.log("Navigating to Indeed homepage...");
        await page.goto("https://www.indeed.com/", { waitUntil: "load" });

        console.log("Clicking 'Sign in'...");
        const signInBtn = page.locator('a[data-gnav-element-name="SignIn"], a:has-text("Sign in")').first();
        await signInBtn.waitFor({ state: "visible", timeout: 15000 });
        await signInBtn.click();

        console.log("Waiting for login page...");
        const emailHeader = page.locator('h1:has-text("Ready to take the next step?"), h1[data-tn-section="auth-page-header--enter-email"]').first();
        await emailHeader.waitFor({ state: "visible", timeout: 20000 });
        
        console.log("Step 2: Clicking 'Continue with Google'...");
        const googleBtn = page.locator('button:has-text("Continue with Google"), #login-google-button').first();
        await googleBtn.waitFor({ state: "visible", timeout: 15000 });
        
        const [popup] = await Promise.all([
            page.context().waitForEvent("page", { timeout: 30000 }),
            googleBtn.click()
        ]);

        console.log("Google popup opened!");
        await popup.waitForLoadState("load");
        await popup.screenshot({ path: "step2_google_popup.png" });
        
        const popupTitle = await popup.title();
        console.log(`Popup title: ${popupTitle}`);

        if (popupTitle.includes("Google")) {
            console.log("Successfully reached Google OAuth page!");
        } else {
            console.log("Popup opened but might not be the Google login page yet.");
        }

    } catch (err: any) {
        console.error("Step 2 failed:", err.message);
        await page.screenshot({ path: "step2_failure.png" });
    } finally {
        await context.close();
    }
}

step2();
