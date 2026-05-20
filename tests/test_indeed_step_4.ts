import { chromium } from "playwright";
import * as path from "path";
import { ExcelHandler } from "../src/excelHandler.js";

async function step4() {
    const baseDir = process.cwd();
    const excelHandler = new ExcelHandler(baseDir);
    const credentials = await excelHandler.readCredentials();
    const creds = credentials[0];

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
        console.log("Step 4: Navigating to Profile to check login status...");
        await page.goto("https://profile.indeed.com/", { waitUntil: "load" });
        await page.waitForTimeout(5000); // Wait for potential redirects

        let currentUrl = page.url();
        console.log(`Current URL: ${currentUrl}`);
        
        let isLoggedIn = currentUrl.includes("profile.indeed.com");
        
        if (!isLoggedIn) {
            console.log("Redirected to login, performing login flow...");
            // Handle Cloudflare if needed on login page
            let title = await page.title();
            if (title.includes("Just a moment") || title.includes("Cloudflare")) {
                await page.waitForFunction(() => !document.title.includes("Just a moment"), { timeout: 30000 }).catch(() => {});
                await page.waitForTimeout(5000);
            }

            const signInBtn = page.locator('a:has-text("Sign in"), a:has-text("Log in"), a[href*="auth"], a[href*="login"], .button-signin').first();
            await signInBtn.waitFor({ state: "visible", timeout: 15000 });
            await signInBtn.click();
            
            console.log("Clicking 'Continue with Google'...");
            const googleBtn = page.locator('button:has-text("Continue with Google"), #login-google-button').first();
            await googleBtn.waitFor({ state: "visible", timeout: 15000 });
            
            const [popup] = await Promise.all([
                page.context().waitForEvent("page"),
                googleBtn.click()
            ]);
            
            await popup.waitForLoadState("load");
            await popup.waitForTimeout(3000);
            
            const accountChoice = popup.locator(`[data-email*="${creds.indeedEmail}"], [aria-label*="${creds.indeedEmail}"], li:has-text("${creds.indeedEmail}")`).first();
            if (await accountChoice.isVisible()) {
                console.log("Selecting Google account...");
                await accountChoice.click();
            } else {
                console.log("Performing manual Google login in popup...");
                const emailInput = popup.locator('input[type="email"]').first();
                await emailInput.fill(creds.indeedEmail);
                await popup.locator('button:has-text("Next")').first().click();
                await popup.locator('input[type="password"]').first().waitFor({ state: "visible" });
                await popup.locator('input[type="password"]').first().fill(creds.indeedPassword);
                await popup.locator('button:has-text("Next")').first().click();
            }
            
            console.log("Waiting for redirect back to Indeed...");
            await page.waitForURL(/.*profile\.indeed\.com.*/, { timeout: 60000 });
        }

        console.log("Reached Profile page successfully.");
        await page.screenshot({ path: "step4_profile_page.png" });

        console.log("Looking for Resume section...");
        // Selector from guide: <div class="css-1e9y1g e37uo190">
        const resumeSection = page.locator('div.css-1e9y1g.e37uo190').first();
        await resumeSection.waitFor({ state: "visible", timeout: 15000 });
        
        console.log("Clicking Resume section...");
        await resumeSection.click();
        await page.waitForTimeout(3000); 
        await page.screenshot({ path: "step4_after_resume_click.png" });

        console.log("Looking for 'Replace file' button...");
        const replaceBtn = page.locator('button:has-text("Replace file"), [data-tn-element="replace-menu-btn"]').first();
        
        await replaceBtn.waitFor({ state: "attached", timeout: 15000 });
        
        const btnDetails = await replaceBtn.evaluate((el) => {
            const style = window.getComputedStyle(el);
            return {
                visible: el.offsetWidth > 0 && el.offsetHeight > 0 && style.display !== 'none' && style.visibility !== 'hidden',
                display: style.display,
                visibility: style.visibility,
                text: el.innerText,
                html: el.outerHTML
            };
        });
        console.log("Button details:", btnDetails);

        console.log("Attempting JavaScript click on 'Replace file'...");
        await replaceBtn.evaluate((el: HTMLElement) => el.click());
        
        console.log("Waiting for file chooser or next state...");
        await page.waitForTimeout(5000);
        await page.screenshot({ path: "step4_after_js_click.png" });
        
        console.log("Successfully triggered Resume replacement!");

    } catch (err: any) {
        console.error("Step 4 failed:", err.message);
        await page.screenshot({ path: "step4_failure.png" });
    } finally {
        await context.close();
    }
}

step4();
