import { chromium } from "playwright";
import * as path from "path";
import { ExcelHandler } from "../src/excelHandler.js";

async function step3() {
    const baseDir = process.cwd();
    const excelHandler = new ExcelHandler(baseDir);
    const credentials = await excelHandler.readCredentials();
    const creds = credentials[0]; // Testing with the first candidate

    if (!creds || !creds.indeedEmail) {
        console.error("No credentials found!");
        return;
    }
    console.log(`Testing Indeed login for candidate: ${creds.indeedEmail}`);

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
        
        console.log("Clicking 'Continue with Google'...");
        const googleBtn = page.locator('button:has-text("Continue with Google"), #login-google-button').first();
        await googleBtn.waitFor({ state: "visible", timeout: 15000 });
        
        const [popup] = await Promise.all([
            page.context().waitForEvent("page", { timeout: 30000 }),
            googleBtn.click()
        ]);

        console.log("Step 3: Handling Google Authentication...");
        await popup.waitForLoadState("load");
        await popup.waitForTimeout(5000); 
        console.log(`Popup URL: ${popup.url()}`);
        console.log(`Popup Title: ${await popup.title()}`);
        
        await popup.screenshot({ path: "step3_popup_initial.png" });
        
        // Log some text from the popup to see where we are
        const bodyText = await popup.innerText('body');
        console.log("Popup Body Text (first 500 chars):", bodyText.substring(0, 500).replace(/\n/g, ' '));

        // Account Picker or Email Input
        const accountChoice = popup.locator(`[data-email*="${creds.indeedEmail}"], [aria-label*="${creds.indeedEmail}"], li:has-text("${creds.indeedEmail}")`).first();

        if (await accountChoice.isVisible()) {
            console.log(`Selecting existing Google account: ${creds.indeedEmail}`);
            await accountChoice.click();
        } else if (bodyText.includes("Use another account")) {
            console.log("Clicking 'Use another account'...");
            await popup.locator(':text("Use another account")').first().click();
            await popup.waitForTimeout(2000);
            
            console.log("Entering Google email...");
            const emailInput = popup.locator('input[type="email"], input[name="identifier"], #identifierId').first();
            await emailInput.waitFor({ state: "visible", timeout: 15000 });
            await emailInput.fill(creds.indeedEmail);
            await popup.locator('button:has-text("Next"), #identifierNext, button[jsname="Lgbs9"]').first().click();
            
            console.log("Entering Google password...");
            const passInput = popup.locator('input[type="password"], input[name="password"]').first();
            await passInput.waitFor({ state: "visible", timeout: 20000 });
            await passInput.fill(creds.indeedPassword);
            await popup.locator('button:has-text("Next"), #passwordNext, button[jsname="Lgbs9"]').first().click();
        } else {
            console.log("Entering Google email (Direct)...");
            // More robust selectors for Google email
            const emailInput = popup.locator('input[type="email"], input[name="identifier"], #identifierId').first();
            await emailInput.waitFor({ state: "visible", timeout: 15000 });
            await emailInput.fill(creds.indeedEmail);
            await popup.locator('button:has-text("Next"), #identifierNext, button[jsname="Lgbs9"]').first().click();
            
            console.log("Entering Google password...");
            const passInput = popup.locator('input[type="password"], input[name="password"]').first();
            await passInput.waitFor({ state: "visible", timeout: 20000 });
            await passInput.fill(creds.indeedPassword);
            await popup.locator('button:has-text("Next"), #passwordNext, button[jsname="Lgbs9"]').first().click();
        }

        console.log("Waiting for popup to close and redirect to Indeed...");
        await popup.waitForEvent("close", { timeout: 60000 }).catch(() => console.log("Popup didn't close automatically, continuing..."));

        console.log("Verifying Indeed login status...");
        // Wait for the account icon or profile link on Indeed
        await page.waitForSelector('button[aria-label="Account icon"], a[href*="profile"]', { timeout: 60000 });
        console.log("Login successful! Reached Indeed logged-in state.");
        await page.screenshot({ path: "step3_logged_in.png" });

    } catch (err: any) {
        console.error("Step 3 failed:", err.message);
        await page.screenshot({ path: "step3_failure.png" });
    } finally {
        await context.close();
    }
}

step3();
