import { chromium, Browser, BrowserContext, Page } from "playwright";
import * as path from "path";
import * as fs from "fs";
import { DiceCredentials } from "./excelHandler.js";

export class DiceService {
        private browser: Browser | null = null;
        private context: BrowserContext | null = null;
        private page: Page | null = null;
        private readonly screenshotsDir: string;
        private readonly resumesDir: string;
        private readonly tempDir: string;
        
        private readonly headless: boolean;
        private readonly slowMo: number;

        constructor(baseDir: string, options?: { headless?: boolean; slowMo?: number }) {
                this.screenshotsDir = path.join(baseDir, "screenshots");
                this.resumesDir = path.join(baseDir, "resumes");
                this.tempDir = path.join(baseDir, "temp");
                this.headless = options?.headless ?? false;
                this.slowMo = options?.slowMo ?? 0;

                // Ensure directories exist
                [this.screenshotsDir, this.resumesDir, this.tempDir].forEach((d) => {
                        if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
                });
        }

        /**
           * Idempotent init: will not launch a new browser if one already exists.
              */
        async init() {
                if (this.browser) return;
                this.browser = await chromium.launch({ headless: this.headless, slowMo: this.slowMo });
                this.context = await this.browser.newContext({ acceptDownloads: true, viewport: { width: 1280, height: 720 } });
                this.page = await this.context.newPage();
        }

        /**
           * Robust close: closes page, context and browser and clears references.
              */
        async close() {
                try {
                        if (this.page) {
                                await this.page.close().catch(() => { });
                                this.page = null;
                        }
                        if (this.context) {
                                await this.context.close().catch(() => { });
                                this.context = null;
                        }
                        if (this.browser) {
                                await this.browser.close().catch(() => { });
                                this.browser = null;
                        }
                } catch {
                        // swallow close errors to avoid crashing orchestration
                }
        }

        // Utility: Random delay to mimic human behavior and avoid rate limits
        private async randomDelay(min = 300, max = 1200) {
                const ms = Math.floor(Math.random() * (max - min + 1)) + min;
                if (this.page) await this.page.waitForTimeout(ms);
                else await new Promise((r) => setTimeout(r, ms));
        }


        private randomTypingDelay() {
                return Math.floor(Math.random() * 80) + 40; // 40–120ms per keystroke
        }

        private async typeLikeHuman(locator: any, text: string) {
                try {
                        if (typeof locator.type === "function") {
                                await locator.fill("");
                                await locator.type(text, { delay: this.randomTypingDelay() });
                                return;
                        }
                } catch { /* fallback below */ }

                try {
                        if (typeof locator.focus === "function") {
                                await locator.focus();
                        }
                } catch { /* ignore */ }

                for (const ch of text) {
                        try {
                                await this.page?.keyboard.type(ch, { delay: this.randomTypingDelay() });
                        } catch { /* ignore keystroke errors */ }
                }
        }

        /**
           * Login to Dice with retries, human-like typing, and diagnostic logging.
              */
        async login(creds: DiceCredentials, maxAttempts = 2): Promise<void> {
                if (!this.page) throw new Error("Page not initialized");

                let attempt = 0;
                let lastError: Error | null = null;

                while (attempt < maxAttempts) {
                        attempt++;
                        try {
                                console.log(`[${creds.email}] Attempt ${attempt} - Navigating to Dice login page...`);
                                const response = await this.page.goto("https://www.dice.com/dashboard/login", { waitUntil: "networkidle", timeout: 60000 });
                                await this.randomDelay(500, 1500);

                                if (response && response.status() >= 400) {
                                        throw new Error(`account not exists or deleted (Status ${response.status()})`);
                                }

                                // Cookie consent / banner
                                try {
                                        const allowBtn = this.page.locator("button:has-text('Allow All'), button:has-text('Accept All'), #onetrust-accept-btn-handler").first();
                                        if (await allowBtn.isVisible().catch(() => false)) {
                                                await allowBtn.click().catch(() => { });
                                                await this.randomDelay(400, 900);
                                        }
                                } catch { /* ignore */ }

                                // Detect common interstitials
                                const bodyText = await this.page.innerText("body").catch(() => "");
                                if (bodyText && /sorry, this page isn’t available|page not found|404|temporarily unavailable/i.test(bodyText)) {
                                        throw new Error("site returned page not available / 404 interstitial");
                                }

                                // Email input
                                const emailSelector = 'input[name="email"], input[placeholder*="email" i], input[type="email"]';
                                await this.page.waitForSelector(emailSelector, { timeout: 30000 });
                                const emailInput = this.page.locator(emailSelector).first();
                                await emailInput.fill("");
                                await this.randomDelay(200, 600);
                                await this.typeLikeHuman(emailInput, creds.email);

                                await this.randomDelay(300, 800);

                                // Click continue/submit if present
                                try {
                                        const continueBtn = this.page.locator("button[type='submit'], button:has-text('Continue'), button:has-text('Next')").first();
                                        if (await continueBtn.isVisible().catch(() => false)) {
                                                await continueBtn.click().catch(() => { });
                                        }
                                } catch { /* ignore */ }

                                // Check for email-not-found messages
                                const postEmailBody = await this.page.innerText("body").catch(() => "");
                                const lower = (postEmailBody || "").toLowerCase();
                                if (lower.includes("not found") || lower.includes("doesn't exist") || lower.includes("no account")) {
                                        throw new Error("account not exists or deleted");
                                }

                                // Password input
                                const passwordSelector = 'input[type="password"], input[name="password"]';
                                await this.page.waitForSelector(passwordSelector, { timeout: 30000 });
                                const passwordInput = this.page.locator(passwordSelector).first();
                                await passwordInput.fill("");
                                await this.randomDelay(200, 600);
                                await this.typeLikeHuman(passwordInput, creds.password);

                                await this.randomDelay(300, 900);

                                // Submit
                                const submitBtn = this.page.locator("button[type='submit'], button:has-text('Sign In'), button:has-text('Log In')").first();
                                if (await submitBtn.isVisible().catch(() => false)) {
                                        await submitBtn.click().catch(() => { });
                                } else {
                                        await passwordInput.press("Enter").catch(() => { });
                                }

                                // Wait for expected post-login URL or indicator (broader pattern)
                                await this.page.waitForURL(/.*(home-feed|dashboard|profile|home)/i, { timeout: 45000 });

                                console.log(`[${creds.email}] Dice login successful.`);
                                return;
                        } catch (err: any) {
                                lastError = err;
                                console.warn(`[${creds.email}] Login attempt ${attempt} failed: ${err?.message || err}`);

                                // capture screenshot for debugging
                                try {
                                        const safeName = creds.email ? creds.email.replace(/[@.]/g, "_") : `dice_error_${Date.now()}`;
                                        const ss = path.join(this.screenshotsDir, `dice_login_error_${safeName}_${Date.now()}.png`);
                                        await this.page?.screenshot({ path: ss }).catch(() => { });
                                } catch { /* ignore */ }

                                // Debug: log current URL and short body snippet
                                try {
                                        console.log(`[DEBUG] Current URL: ${await this.page?.url()}`);
                                        const body = await this.page?.content();
                                        console.log(`[DEBUG] Body snippet: ${body ? body.slice(0, 1500) : "no body"}`);
                                } catch { /* ignore */ }

                                // Inspect body for credential errors
                                const bodyText = await this.page.innerText("body").catch(() => "");
                                const lower = (bodyText || "").toLowerCase();
                                if (lower.includes("match") || lower.includes("invalid") || lower.includes("incorrect")) {
                                        throw new Error("invalid credentials (incorrect password)");
                                }

                                if (attempt < maxAttempts) {
                                        const backoff = 2000 + attempt * 1500;
                                        console.log(`[${creds.email}] Waiting ${backoff}ms before retrying...`);
                                        await this.randomDelay(backoff, backoff + 800);
                                        try {
                                                await this.page.reload({ waitUntil: "networkidle", timeout: 20000 }).catch(() => { });
                                        } catch { /* ignore */ }
                                        continue;
                                }

                                break;
                        }
                }

                if (lastError) throw new Error(lastError.message || "Dice login failed after multiple attempts");
                throw new Error("Dice login failed after multiple attempts");
        }

        /**
           * Update resume on Dice. Returns screenshot path on success.
              */
        async updateResume(creds: DiceCredentials): Promise<string> {
                if (!this.page) throw new Error("Page not initialized");

                console.log(`[${creds.email}] Navigating to Dice profile...`);
                await this.page.goto("https://www.dice.com/profile", { waitUntil: "networkidle", timeout: 60000 });
                await this.randomDelay(800, 1600);

                let resumePath: string;

                if (creds.resumeFilename) {
                        resumePath = path.join(this.resumesDir, creds.resumeFilename);
                        if (!fs.existsSync(resumePath)) {
                                throw new Error(`Resume file not found: ${resumePath}`);
                        }
                        console.log(`[${creds.email}] Using local resume: ${creds.resumeFilename}`);
                } else {
                        console.log(`[${creds.email}] No local resume provided. Attempting to refresh existing...`);
                        resumePath = await this.downloadCurrentResume(creds.email);
                }

                console.log(`[${creds.email}] Uploading resume...`);
                const fileInput = await this.page.waitForSelector("input#resume-upload, input[aria-label='Upload resume'], input[type='file']", { timeout: 20000 }).catch(() => null);
                if (!fileInput) throw new Error("Resume upload input not found on Dice profile page");

                await fileInput.setInputFiles(resumePath);
                await this.randomDelay(1000, 2500);

                // Handle "Parse Resume Skills" dialog if it appears
                try {
                        await this.page.waitForTimeout(1000);
                        const yesButton = this.page.locator("seds-button, button").filter({ hasText: /^Yes$/i }).first();
                        if (await yesButton.isVisible().catch(() => false)) {
                                console.log(`[${creds.email}] "Parse Resume Skills" dialog detected. Clicking Yes...`);
                                await yesButton.click({ force: true }).catch(() => { });
                        }
                } catch (e) {
                        console.log(`[${creds.email}] No parse dialog or interaction failed: ${e?.message || e}`);
                }

                await this.randomDelay(3000, 6000);

                const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
                const screenshotPath = path.join(this.screenshotsDir, `success_${creds.email.split("@")[0]}_${timestamp}.png`);
                await this.page.screenshot({ path: screenshotPath }).catch(() => { });

                console.log(`[${creds.email}] Dice resume update completed.`);
                return screenshotPath;
        }

        /**
           * Download the current resume from Dice profile (used when no local resume provided).
              */
        private async downloadCurrentResume(email: string): Promise<string> {
                if (!this.page) throw new Error("Page not initialized");

                const downloadButton = await this.page.waitForSelector("button[aria-label*='Download' i], a[title*='Download' i], .sc-dhi-candidates-candidate-profile-resume-field a", { timeout: 15000 }).catch(() => null);
                if (!downloadButton) throw new Error("Download button not found to refresh existing resume");

                const [download] = await Promise.all([
                        this.page.waitForEvent("download"),
                        downloadButton.click().catch(() => { })
                ]);

                const downloadPath = path.join(this.tempDir, `current_resume_${email.split("@")[0]}.pdf`);
                await download.saveAs(downloadPath);
                return downloadPath;
        }

        /**
           * Capture an error screenshot and return its path.
              */
        async captureError(email: string): Promise<string> {
                if (!this.page) return "";
                const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
                const screenshotPath = path.join(this.screenshotsDir, `error_${email.split("@")[0]}_${timestamp}.png`);
                await this.page.screenshot({ path: screenshotPath }).catch(() => { });
                return screenshotPath;
        }
}
