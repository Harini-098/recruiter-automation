import { chromium, Browser, BrowserContext, Page } from "playwright";
import * as path from "path";
import * as fs from "fs";
import { CandidateCredentials } from "./excelHandler.js";
import { Logger } from "./logger.js";

const STORAGE_STATE_FILE = "monster-auth.json";

export class MonsterService {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private readonly resumesDir: string;
  private readonly tempDir: string;
  private readonly headless: boolean;
  private readonly slowMo: number;
  private readonly logger: Logger;

  constructor(baseDir: string, logger: Logger, options?: { headless?: boolean; slowMo?: number }) {
    this.resumesDir = path.join(baseDir, "resumes");
    this.tempDir = path.join(baseDir, "temp");
    this.headless = options?.headless ?? false;
    this.slowMo = options?.slowMo ?? 1000;
    this.logger = logger;

    // Ensure directories exist
    [this.resumesDir, this.tempDir].forEach((d) => {
      if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
    });
  }

  async init() {
    if (this.browser) return;

    this.logger.info("Monster", "Opening browser");
    this.browser = await chromium.launch({
      headless: this.headless,
      slowMo: this.slowMo,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--no-sandbox',
        '--disable-setuid-sandbox'
      ]
    });

    const storage = fs.existsSync(STORAGE_STATE_FILE) ? STORAGE_STATE_FILE : undefined;

    this.context = await this.browser.newContext({
      storageState: storage,
      acceptDownloads: true,
      viewport: { width: 1024, height: 768 },
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36",
    });

    // Enhanced Stealth
    await this.context.addInitScript(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => undefined });
      (window as any).chrome = { runtime: {}, loadTimes: function() {}, csi: function() {}, app: {} };
    });

    this.page = await this.context.newPage();
  }

  async close() {
    try {
      if (this.browser) {
        this.logger.info("Monster", "Closing browser");
        await this.browser.close();
        this.browser = null;
        this.context = null;
        this.page = null;
      }
    } catch (err: any) {
        this.logger.warn("Monster", `Error during browser close: ${err.message}`);
    }
  }

  async login(creds: CandidateCredentials, maxAttempts = 2): Promise<void> {
    if (!this.page) throw new Error("Page not initialized");

    let attempt = 0;
    while (attempt < maxAttempts) {
      attempt++;
      try {
        this.logger.info("Monster", `Login attempt ${attempt} for ${creds.monsterEmail}`);
        await this.page.goto("https://www.monster.com/", { waitUntil: "load", timeout: 60000 });
        
        // Handle Cookie Banner
        try {
          const cookieBtn = this.page.locator("button:has-text('Got It'), #onetrust-accept-btn-handler").first();
          if (await cookieBtn.isVisible()) {
            await cookieBtn.click();
            this.logger.info("Monster", "Accepted cookies");
          }
        } catch (e) {}

        // Bot detection
        let bodyContent = await this.page.content();
        if (bodyContent.includes("Verification Required") || bodyContent.includes("Slide right to secure your access")) {
            this.logger.warn("Monster", "CAPTCHA detected! Manual intervention might be needed.");
            try {
                await this.page.waitForFunction(() => {
                    const content = document.body.innerText;
                    return !content.includes("Verification Required") && !content.includes("Slide right to secure your access");
                }, { timeout: 120000 });
                this.logger.info("Monster", "CAPTCHA solved");
                await this.page.waitForTimeout(5000);
            } catch (e) {
                await this.logger.captureScreenshot(this.page, "Monster", "captcha_timeout");
                throw new Error("CAPTCHA solve timeout");
            }
        }

        const title = await this.page.title();
        if (title.includes("Access Denied") || bodyContent.includes("cloudflare") || bodyContent.includes("Pardon Our Interruption")) {
           await this.logger.captureScreenshot(this.page, "Monster", "bot_detection");
           throw new Error(`Bot detection triggered`);
        }

        this.logger.info("Monster", "Finding login trigger");
        const homeLoginSelector = "a:has-text('Log in'), a:has-text('Log In'), #Input_Email";
        const found = await this.page.waitForSelector(homeLoginSelector, { timeout: 15000 }).catch(() => null);

        if (!found) {
            await this.page.goto("https://www.monster.com/signin", { waitUntil: "load" });
        } else {
            const isEmailField = await found.getAttribute("id") === "Input_Email";
            if (!isEmailField) {
                await found.click({ force: true });
                await this.page.waitForSelector("#Input_Email", { timeout: 20000 }).catch(() => null);
            }
        }

        this.logger.info("Monster", "Entering credentials");
        await this.page.fill("#Input_Email", creds.monsterEmail);
        await this.page.click("#passwordInput");
        await this.page.fill("#passwordInput", creds.monsterPassword);
        await this.page.click("button.login-btn");

        const result = await Promise.race([
          this.page.waitForSelector("a[data-testid='profile-link'], button[aria-label='Log Out']", { timeout: 30000 }).then(() => "success"),
          this.page.waitForSelector(".alert-danger, [class*='error' i], #validation-summary", { timeout: 20000 }).then(() => "error").catch(() => "timeout")
        ]);

        if (result === "success") {
            this.logger.info("Monster", "Login successful");
            return;
        }

        const bodyText = await this.page.innerText("body").catch(() => "");
        if (bodyText.toLowerCase().includes("not found") || bodyText.toLowerCase().includes("doesn't exist")) {
            throw new Error("account not exists");
        }

        await this.logger.captureScreenshot(this.page, "Monster", "login_failure");
        throw new Error(`Login failed (Result: ${result})`);

      } catch (err: any) {
        if (attempt >= maxAttempts) throw err;
        this.logger.warn("Monster", `Attempt ${attempt} failed: ${err.message}. Retrying...`);
        await this.page.reload();
      }
    }
  }

  async updateResume(creds: CandidateCredentials): Promise<void> {
    if (!this.page) throw new Error("Page not initialized");

    this.logger.info("Monster", "Navigating to 'My Profile'");
    const profileLink = this.page.locator('[data-testid="profile-navigation-item-profile"], a[aria-label="My Profile"]').first();
    
    try {
        await profileLink.waitFor({ state: "visible", timeout: 15000 });
        await profileLink.click();
    } catch (e) {
        await this.page.goto("https://www.monster.com/profile/detail", { waitUntil: "load" }).catch(() => {});
    }

    try {
        await this.page.waitForURL(/.*profile\/detail.*/, { timeout: 15000 });
    } catch (e) {}

    const resumePath = path.join(this.resumesDir, creds.resumeFilename!);
    if (!fs.existsSync(resumePath)) {
         throw new Error(`Resume file not found: ${resumePath}`);
    }

    this.logger.info("Monster", `Uploading resume: ${path.basename(resumePath)}`);
    
    try {
        const editResumeLink = this.page.locator('[data-testid="resume-document-section-editlink"], a[aria-label="EDIT - My Resume"]').first();
        await editResumeLink.waitFor({ state: "visible", timeout: 15000 });
        await editResumeLink.click();

        const fileInput = await this.page.waitForSelector("input[type='file']", { timeout: 15000 });
        await fileInput.setInputFiles(resumePath);

        const useDocumentBtn = this.page.locator("[data-testid='onboarding-use-this-document-button'], button:has-text('Upload This Document')").first();
        if (await useDocumentBtn.isVisible({ timeout: 10000 })) {
            await useDocumentBtn.click();
        }

        const justUploadBtn = this.page.locator("button:has-text('Just upload'), button:has-text('Just Upload')").first();
        if (await justUploadBtn.isVisible({ timeout: 5000 })) {
            await justUploadBtn.click();
        }

        await this.page.waitForTimeout(5000);
        this.logger.info("Monster", "Resume update complete");
    } catch (err: any) {
        await this.logger.captureScreenshot(this.page, "Monster", "upload_failure");
        throw err;
    }
  }
}
