import { chromium, Browser, BrowserContext, Page } from "playwright";
import * as path from "path";
import * as fs from "fs";
import { CandidateCredentials } from "./excelHandler.js";


//this file stores login state to reuse session and avoid login every time, it will be created after first successful login and updated on subsequent logins
const STORAGE_STATE_FILE = "monster-auth.json";

export class MonsterService {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private readonly resumesDir: string;
  private readonly tempDir: string;
  private readonly headless: boolean;
  private readonly slowMo: number;

  constructor(baseDir: string, options?: { headless?: boolean; slowMo?: number }) {
    this.resumesDir = path.join(baseDir, "resumes");
    this.tempDir = path.join(baseDir, "temp");
    this.headless = options?.headless ?? false;
    this.slowMo = options?.slowMo ?? 1000;

    // Ensure directories exist
    [this.resumesDir, this.tempDir].forEach((d) => {
      if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
    });

  }

  /**
   * Idempotent init: will not launch a new browser if one already exists.
   * Loads storageState if available to enable session reuse.
   */
  async init() {
    if (this.browser) return;

    this.browser = await chromium.launch({
      headless: this.headless,
      slowMo: this.slowMo
    });


    //check if storage state file exists to reuse session and avoid login every time
    const storage = fs.existsSync(STORAGE_STATE_FILE) ? STORAGE_STATE_FILE : undefined;


    this.context = await this.browser.newContext({
      storageState: storage,
      acceptDownloads: true,
      viewport: { width: 1280, height: 720 },
      // Set a common user agent to reduce bot detection risk which makes it look like real chrome browser
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    });

    // Stealth: Hide webdriver flag(websites uses this to detect automation) and add random delay to mimic human behavior
    await this.context.addInitScript(() => {
      Object.defineProperty(navigator, "webdriver", {
        //nomrally this would be set to true in automated browsers, but we set it to undefined to avoid detection
        get: () => undefined,
      });
    });

    this.page = await this.context.newPage();
    console.log("open monster.com");
  }

  /**
   * Robust close: closes page, context and browser and clears references.
   */
  async close() {
    try {
      if (this.page) {
        await this.page.close().catch(() => {});
        this.page = null;
      }
      if (this.context) {
        await this.context.close().catch(() => {});
        this.context = null;
      }
      if (this.browser) {
        await this.browser.close().catch(() => {});
        this.browser = null;
      }
    } catch {
      // swallow close errors to avoid crashing orchestration
    }
  }

  async login(creds: CandidateCredentials, maxAttempts = 2): Promise<void> {
    if (!this.page) throw new Error("Page not initialized");

    let attempt = 0;
    while (attempt < maxAttempts) {
      attempt++;
      try {
        await this.page.goto("https://www.monster.com", { waitUntil: "networkidle", timeout: 60000 });
        
        // Bot detection check
        const title = await this.page.title();
        const bodyContent = await this.page.content();
        if (title.includes("Access Denied") || bodyContent.includes("cloudflare") || bodyContent.includes("Pardon Our Interruption")) {
           throw new Error("Bot detection triggered (Cloudflare/Akamai block)");
        }

        console.log("enter email, password");
        const emailSelector = 'input[type="email"], input[name="email"], #email';
        await this.page.waitForSelector(emailSelector, { timeout: 15000 });
        await this.page.fill(emailSelector, creds.monsterEmail);
        
        const passwordSelector = 'input[type="password"], input[name="password"], #password';
        await this.page.fill(passwordSelector, creds.monsterPassword);

        await this.page.click("button[type='submit'], button:has-text('Sign In')");

        // Wait for login or error
        await Promise.race([
          this.page.waitForURL(/.*(profile|dashboard|home)/i, { timeout: 20000 }),
          this.page.waitForSelector(".error, [class*='error' i], :has-text('incorrect')", { timeout: 20000 }).catch(() => null)
        ]);

        const currentUrl = this.page.url();
        if (!currentUrl.includes("profile") && !currentUrl.includes("dashboard") && !currentUrl.includes("home")) {
            const bodyText = await this.page.innerText("body").catch(() => "");
            if (bodyText.toLowerCase().includes("not found") || bodyText.toLowerCase().includes("doesn't exist")) {
                throw new Error("account not exists");
            }
            throw new Error("Invalid credentials or login failed");
        }

        return;
      } catch (err: any) {
        if (err.message === "account not exists") throw err;
        if (attempt >= maxAttempts) throw err;
        await this.page.reload();
      }
    }
  }

  async updateResume(creds: CandidateCredentials): Promise<void> {
    if (!this.page) throw new Error("Page not initialized");

    console.log("login and update the resume");
    await this.page.goto("https://www.monster.com/profile/detail", { waitUntil: "networkidle" });

    if (!creds.resumeFilename) return;

    const resumePath = path.join(this.resumesDir, creds.resumeFilename);
    const fileInput = await this.page.waitForSelector('input[type="file"]', { timeout: 15000 });
    await fileInput.setInputFiles(resumePath);

    // Overwrite confirmation
    try {
      const confirmBtn = this.page.locator("button:has-text('Overwrite'), button:has-text('Upload')").first();
      await confirmBtn.click({ timeout: 5000 });
    } catch (e) {}

    await this.page.waitForTimeout(5000);
  }
}                                                                                                                                                                    

 

