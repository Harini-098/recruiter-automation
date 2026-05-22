import { chromium, Browser, BrowserContext, Page } from "playwright";
import * as path from "path";
import * as fs from "fs";
import { CandidateCredentials } from "./excelHandler.js";
import { Logger } from "./logger.js";

export class DiceService {
    private browser: Browser | null = null;
    private context: BrowserContext | null = null;
    private page: Page | null = null;
    private readonly resumesDir: string;
    private readonly tempDir: string;
    private readonly logger: Logger;

    constructor(baseDir: string, logger: Logger) {
        this.resumesDir = path.join(baseDir, "resumes");
        this.tempDir = path.join(baseDir, "temp");
        this.logger = logger;
    }

    async init() {
        this.logger.info("Dice", "Opening browser");
        this.browser = await chromium.launch({ 
            headless: false,
            slowMo: 1000 // Visibility delay
        });
        this.context = await this.browser.newContext({
            acceptDownloads: true,
            viewport: { width: 1280, height: 720 },
            userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
        });
        this.page = await this.context.newPage();
    }

    async login(creds: CandidateCredentials): Promise<void> {
        if (!this.page) throw new Error("Page not initialized");

        this.logger.info("Dice", `Attempting login for ${creds.diceEmail}`);
        await this.page.goto("https://www.dice.com/dashboard/login", { waitUntil: "networkidle" });
        
        try {
            await this.page.click("button:has-text(\"Allow All\")", { timeout: 3000 });
        } catch (e) { }

        this.logger.info("Dice", "Entering email");
        await this.page.fill("input[name=\"email\"], input[placeholder*=\"email\" i]", creds.diceEmail);
        await this.page.click("button[type=\"submit\"], button:has-text(\"Continue\")");

        // Check if email was accepted or error shown
        const errorText = await this.page.innerText("body").catch(() => "");
        if (errorText.toLowerCase().includes("not found") || errorText.toLowerCase().includes("doesn't exist")) {
            await this.logger.captureScreenshot(this.page, "Dice", "account_not_found");
            throw new Error("account not exists or deleted");
        }

        await this.page.waitForSelector("input[type=\"password\"]", { timeout: 10000 });
        this.logger.info("Dice", "Entering password");
        await this.page.fill("input[type=\"password\"]", creds.dicePassword);
        await this.page.click("button[type=\"submit\"], button:has-text(\"Sign In\")");

        try {
            await this.page.waitForURL("**/home-feed", { timeout: 15000 });
            this.logger.info("Dice", "Login successful");
        } catch (e) {
            const bodyText = await this.page.innerText("body").catch(() => "");
            
            // Capture screenshot on failure
            await this.logger.captureScreenshot(this.page, "Dice", "login_failure");

            if (bodyText.toLowerCase().includes("incorrect username or password") || 
                bodyText.toLowerCase().includes("match") || 
                bodyText.toLowerCase().includes("invalid")) {
                throw new Error("account not exists or deleted (Invalid credentials)");
            }
            throw new Error("Dice login failed (Timeout or unexpected page)");
        }
    }

    async updateResume(creds: CandidateCredentials): Promise<void> {
        if (!this.page) throw new Error("Page not initialized");

        this.logger.info("Dice", "Navigating to profile");
        await this.page.goto("https://www.dice.com/profile", { waitUntil: "networkidle" });

        let resumePath: string;

        if (creds.resumeFilename) {
            resumePath = path.join(this.resumesDir, creds.resumeFilename);
            if (!fs.existsSync(resumePath)) {
                throw new Error(`Resume file not found: ${resumePath}`);
            }
        } else {
            this.logger.info("Dice", "Downloading current resume as fallback");
            resumePath = await this.downloadCurrentResume(creds.diceEmail);
        }

        this.logger.info("Dice", `Uploading resume: ${path.basename(resumePath)}`);
        
        try {
            const fileInput = await this.page.waitForSelector("input#resume-upload, input[aria-label=\"Upload resume\"]", { timeout: 15000 });
            await fileInput.setInputFiles(resumePath);

            try {
                const yesButton = this.page.locator("seds-button").filter({ hasText: /^Yes$/i }).first();
                await yesButton.waitFor({ state: "visible", timeout: 10000 });
                this.logger.info("Dice", "Confirming parsing dialog");
                await yesButton.click({ force: true });
            } catch (e) {
                // Dialog might not always appear
            }

            await this.page.waitForTimeout(3000); 
            this.logger.info("Dice", "Resume update complete");
        } catch (err: any) {
            await this.logger.captureScreenshot(this.page, "Dice", "upload_failure");
            throw err;
        }
    }

    private async downloadCurrentResume(email: string): Promise<string> {
        if (!this.page) throw new Error("Page not initialized");

        try {
            const downloadButton = await this.page.waitForSelector("button[aria-label*=\"Download\" i], a[title*=\"Download\" i], .sc-dhi-candidates-candidate-profile-resume-field a", { timeout: 10000 });
            
            const [download] = await Promise.all([
                this.page.waitForEvent("download"),
                downloadButton.click()
            ]);

            const downloadPath = path.join(this.tempDir, `current_resume_${email.split("@")[0]}.pdf`);
            await download.saveAs(downloadPath);
            return downloadPath;
        } catch (err: any) {
            await this.logger.captureScreenshot(this.page, "Dice", "download_failure");
            throw new Error(`Failed to download resume: ${err.message}`);
        }
    }

    async close() {
        if (this.browser) {
            this.logger.info("Dice", "Closing browser");
            await this.browser.close();
        }
    }
}
