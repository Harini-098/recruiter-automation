import { chromium, Browser, BrowserContext, Page } from "playwright";
import * as path from "path";
import * as fs from "fs";
import { CandidateCredentials } from "./excelHandler.js";

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
      deviceScaleFactor: 1,
      hasTouch: false,
      isMobile: false,
      locale: "en-US",
      timezoneId: "America/New_York",
    });

    // Enhanced Stealth
    await this.context.addInitScript(() => {
      // Hide webdriver
      Object.defineProperty(navigator, "webdriver", { get: () => undefined });
      
      // Fake window.chrome
      (window as any).chrome = {
        runtime: {},
        loadTimes: function() {},
        csi: function() {},
        app: {}
      };

      // Overwrite the `plugins` property
      Object.defineProperty(navigator, "plugins", {
        get: () => [1, 2, 3, 4, 5],
      });

      // Overwrite the `languages` property
      Object.defineProperty(navigator, "languages", {
        get: () => ["en-US", "en"],
      });

      // Mock permissions
      const originalQuery = window.navigator.permissions.query;
      (window.navigator.permissions as any).query = (parameters: any) => (
        parameters.name === 'notifications' ?
          Promise.resolve({ state: Notification.permission }) :
          originalQuery(parameters)
      );
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
        console.log(`Login attempt ${attempt} starting...`);
        await this.page.goto("https://www.monster.com/", { waitUntil: "load", timeout: 60000 });
        
        // Handle Cookie Banner
        try {
          const cookieBtn = this.page.locator("button:has-text('Got It'), #onetrust-accept-btn-handler").first();
          if (await cookieBtn.isVisible()) {
            await cookieBtn.click();
            console.log("Accepted cookie banner");
          }
        } catch (e) {}

        // Bot detection and 404 check
        let bodyContent = await this.page.content();
        if (bodyContent.includes("Verification Required") || bodyContent.includes("Slide right to secure your access")) {
            console.log("⚠️ CAPTCHA detected! Please solve the slider in the browser window...");
            try {
                await this.page.waitForFunction(() => {
                    const content = document.body.innerText;
                    return !content.includes("Verification Required") && !content.includes("Slide right to secure your access");
                }, { timeout: 120000 });
                console.log("✅ CAPTCHA solved. Waiting for session to validate...");
                await this.page.waitForTimeout(5000);
                bodyContent = await this.page.content();
            } catch (e) {
                throw new Error("CAPTCHA solve timeout");
            }
        }

        const title = await this.page.title();
        if (title.includes("Access Denied") || 
            bodyContent.includes("cloudflare") || 
            bodyContent.includes("Pardon Our Interruption") ||
            bodyContent.includes("Access is temporarily restricted")) {
           
           throw new Error(`Bot detection triggered (Access Restricted)`);
        }

        console.log("checking for login button or form");
        const homeLoginSelector = "a:has-text('Log in'), a:has-text('Log In'), span:has-text('Log in'), span:has-text('Log In'), a[href*='mode=Login'], a[href*='signin'], #Input_Email";
        const found = await this.page.waitForSelector(homeLoginSelector, { timeout: 15000 }).catch(() => null);

        if (!found) {
            console.log("Login button not found on home page, navigating directly to signin page");
            await this.page.goto("https://www.monster.com/signin", { waitUntil: "load" });
        } else {
            const isEmailField = await found.getAttribute("id") === "Input_Email";
            if (!isEmailField) {
                console.log("Clicking login button");
                await found.click({ force: true });
                await this.page.waitForSelector("#Input_Email", { timeout: 20000 }).catch(() => null);
            }
        }

        console.log("enter email, password");
        await this.page.fill("#Input_Email", creds.monsterEmail);
        await this.page.click("#passwordInput");
        await this.page.fill("#passwordInput", creds.monsterPassword);
        await this.page.click("button.login-btn");

        // Wait for login success (Profile/Logout icons) or error alert
        const result = await Promise.race([
          this.page.waitForSelector("a[data-testid='profile-link'], button[aria-label='Log Out']", { timeout: 30000 }).then(() => "success"),
          this.page.waitForSelector(".alert-danger, [class*='error' i], #validation-summary", { timeout: 20000 }).then(() => "error").catch(() => "timeout")
        ]);

        if (result === "success") {
            console.log("Login successful (detected authenticated homepage).");
            return;
        }

        const currentUrl = this.page.url();
        const bodyText = await this.page.innerText("body").catch(() => "");
        
        if (bodyText.toLowerCase().includes("not found") || bodyText.toLowerCase().includes("doesn't exist")) {
            throw new Error("account not exists");
        }

        if (result === "error" || result === "timeout") {
            const errorMsg = await this.page.locator(".alert-danger, [class*='error' i]").first().textContent().catch(() => null);
            throw new Error(`Login failed (Result: ${result}, URL: ${currentUrl}, Error: ${errorMsg?.trim() || "Invalid credentials"})`);
        }

        return;
      } catch (err: any) {
        if (attempt >= maxAttempts) throw err;
        console.log(`Login attempt ${attempt} failed: ${err.message}. Retrying...`);
        await this.page.reload();
      }
    }
  }

  async updateResume(creds: CandidateCredentials): Promise<void> {
    if (!this.page) throw new Error("Page not initialized");

    console.log("Navigating to 'My Profile'...");
    // Using the data-testid provided by the user for the profile icon/link
    const profileLink = this.page.locator('[data-testid="profile-navigation-item-profile"], a[aria-label="My Profile"]').first();
    
    try {
        await profileLink.waitFor({ state: "visible", timeout: 15000 });
        await profileLink.click();
        console.log("Clicked 'My Profile' icon");
    } catch (e) {
        console.log("'My Profile' link not found, navigating directly to profile detail page");
        await this.page.goto("https://www.monster.com/profile/detail", { waitUntil: "load" }).catch(() => {});
    }

    // Ensure we are on the profile page
    try {
        await this.page.waitForURL(/.*profile\/detail.*/, { timeout: 15000 });
        console.log("Reached Profile Detail page");
    } catch (e) {
        console.log("Warning: Page URL did not match profile detail, but continuing...");
    }

    let resumePath: string;
    if (creds.resumeFilename) {
        resumePath = path.join(this.resumesDir, creds.resumeFilename);
        if (!fs.existsSync(resumePath)) {
             throw new Error(`Resume file not found: ${resumePath}`);
        }
    } else {
        throw new Error("Local resume filename is required for this simplified flow.");
    }

    console.log("uploading resume file...");
    // 1. Click the Edit link for "My Resume" section
    const editResumeLink = this.page.locator('[data-testid="resume-document-section-editlink"], a[aria-label="EDIT - My Resume"]').first();
    
    try {
        await editResumeLink.waitFor({ state: "visible", timeout: 15000 });
        await editResumeLink.click();
        console.log("Clicked 'EDIT - My Resume' link");
    } catch (e) {
        console.log("Edit resume link not found, attempting to find any file input on page...");
    }

    // 2. Set the file in the hidden input
    try {
        // Use a more generic selector and wait for it to be present in the DOM
        const fileInput = await this.page.waitForSelector("input[type='file']", { timeout: 15000 });
        console.log(`Setting file: ${resumePath}`);
        await fileInput.setInputFiles(resumePath);
        console.log("File set into input successfully.");
    } catch (e) {
        // If specific selector fails, try to find any input type file that might be hidden
        const fallbackInput = await this.page.$("input[type='file']");
        if (fallbackInput) {
            await fallbackInput.setInputFiles(resumePath);
            console.log("File set into fallback input successfully.");
        } else {
            throw new Error("Could not find resume upload input after clicking edit. Please ensure you are on the upload page.");
        }
    }

    // 3. Click "Upload This Document"
    console.log("Waiting for 'Upload This Document' button...");
    const useDocumentBtn = this.page.locator("[data-testid='onboarding-use-this-document-button'], button:has-text('Upload This Document')").first();
    try {
        await useDocumentBtn.waitFor({ state: "visible", timeout: 15000 });
        await useDocumentBtn.click();
        console.log("Clicked 'Upload This Document'");
    } catch (e) {
        console.log("'Upload This Document' button not found, it might have auto-advanced or the selector changed.");
    }

    // 4. Handle "Overwrite Profile?" modal - Click "Just upload"
    console.log("Waiting for 'Just upload' button in modal...");
    const justUploadBtn = this.page.locator("button:has-text('Just upload'), button:has-text('Just Upload')").first();
    try {
        await justUploadBtn.waitFor({ state: "visible", timeout: 15000 });
        await justUploadBtn.click();
        console.log("Clicked 'Just upload' button.");
    } catch (e) {
        console.log("'Just upload' button not found, checking for standard confirm buttons...");
        const confirmBtn = this.page.locator("button:has-text('Overwrite'), button:has-text('Upload'), button:has-text('Confirm')").first();
        if (await confirmBtn.isVisible()) {
            await confirmBtn.click();
            console.log("Clicked fallback upload button.");
        } else {
             console.log("No confirmation button found.");
        }
    }

    await this.page.waitForTimeout(5000);
    console.log("Resume update process finished.");
  }

  private async downloadCurrentResume(email: string): Promise<string> {
    if (!this.page) throw new Error("Page not initialized");

    const downloadButton = await this.page.waitForSelector("[data-testid='profile-resume-document-name']", { timeout: 10000 }).catch(() => null);
    
    if (!downloadButton) {
        throw new Error("Could not find resume to download (refresh failed)");
    }

    const [download] = await Promise.all([
        this.page.waitForEvent("download"),
        downloadButton.click()
    ]);

    const downloadPath = path.join(this.tempDir, `current_monster_${email.split("@")[0]}.pdf`);
    await download.saveAs(downloadPath);
    return downloadPath;
  }
}
