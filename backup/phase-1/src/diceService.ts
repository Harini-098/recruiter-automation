import { chromium, Browser, BrowserContext, Page } from "playwright";
import * as path from "path";
import * as fs from "fs";
import { DiceCredentials } from "./excelHandler.js";

export class DiceService {
    private browser: Browser | null = null;
    private context: BrowserContext | null = null;
    private page: Page | null = null;
    private readonly resumesDir: string;
    private readonly tempDir: string;

    constructor(baseDir: string) {
        this.resumesDir = path.join(baseDir, "resumes");
        this.tempDir = path.join(baseDir, "temp");
    }

    async init() {
        this.browser = await chromium.launch({ headless: false });
        this.context = await this.browser.newContext({
            acceptDownloads: true,
            viewport: { width: 1280, height: 720 }
        });
        this.page = await this.context.newPage();
    }

    async login(creds: DiceCredentials): Promise<void> {
        if (!this.page) throw new Error("Page not initialized");

        console.log(`[${creds.email}] Navigating to login page...`);
        await this.page.goto("https://www.dice.com/dashboard/login", { waitUntil: "networkidle" });

        try {
            await this.page.click("button:has-text(\"Allow All\")", { timeout: 5000 });
        } catch (e) { }

        console.log(`[${creds.email}] Entering email...`);
        await this.page.fill("input[name=\"email\"], input[placeholder*=\"email\" i]", creds.email);
        await this.page.click("button[type=\"submit\"], button:has-text(\"Continue\")");

        console.log(`[${creds.email}] Entering password...`);
        await this.page.waitForSelector("input[type=\"password\"]", { timeout: 10000 });
        await this.page.fill("input[type=\"password\"]", creds.password);
        await this.page.click("button[type=\"submit\"], button:has-text(\"Sign In\")");

        await this.page.waitForURL("**/home-feed", { timeout: 30000 });
        console.log(`[${creds.email}] Login successful.`);
    }

    async updateResume(creds: DiceCredentials): Promise<void> {
        if (!this.page) throw new Error("Page not initialized");

        console.log(`[${creds.email}] Navigating to profile...`);
        await this.page.goto("https://www.dice.com/profile", { waitUntil: "networkidle" });

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
        
        const fileInput = await this.page.waitForSelector("input#resume-upload, input[aria-label=\"Upload resume\"]", { timeout: 15000 });
        await fileInput.setInputFiles(resumePath);

        console.log(`[${creds.email}] Checking for "Parse Resume Skills" dialog...`);
        await this.page.waitForTimeout(3000); 

        try {
            const yesButton = this.page.locator("seds-button").filter({ hasText: /^Yes$/i }).first();
            await yesButton.waitFor({ state: "visible", timeout: 15000 });
            console.log(`[${creds.email}] Dialog found. Clicking "Yes"...`);
            await yesButton.click({ force: true });
            console.log(`[${creds.email}] Clicked "Yes" successfully.`);
        } catch (e) {
            console.log(`[${creds.email}] "Yes" button interaction failed or dialog did not appear.`);
        }

        console.log(`[${creds.email}] Finalizing update...`);
        await this.page.waitForTimeout(5000); 
    }

    private async downloadCurrentResume(email: string): Promise<string> {
        if (!this.page) throw new Error("Page not initialized");

        const downloadButton = await this.page.waitForSelector("button[aria-label*=\"Download\" i], a[title*=\"Download\" i], .sc-dhi-candidates-candidate-profile-resume-field a", { timeout: 10000 });
        
        const [download] = await Promise.all([
            this.page.waitForEvent("download"),
            downloadButton.click()
        ]);

        const downloadPath = path.join(this.tempDir, `current_resume_${email.split("@")[0]}.pdf`);
        await download.saveAs(downloadPath);
        return downloadPath;
    }

    async close() {
        if (this.browser) await this.browser.close();
    }
}
