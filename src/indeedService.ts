import { chromium, BrowserContext, Page } from "playwright";
import * as path from "path";
import * as fs from "fs";
import { CandidateCredentials } from "./excelHandler.js";

const STORAGE_STATE_FILE = "indeed-auth.json";

export class IndeedService {
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
    this.slowMo = options?.slowMo ?? 1500; // Slightly slower for visibility

    [this.resumesDir, this.tempDir].forEach((d) => {
      if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
    });
  }

  async init(email?: string) {
    if (this.context) return;

    // Use a unique temp user data dir for each candidate to avoid session leakage
    const profileId = email ? email.replace(/[^a-zA-Z0-0]/g, '_') : 'default';
    const userDataDir = path.join(process.cwd(), 'temp_chrome_profiles', profileId);
    console.log(`Initializing Chrome with profile: ${profileId}`);

    this.context = await chromium.launchPersistentContext(userDataDir, {
      headless: this.headless,
      slowMo: this.slowMo,
      channel: 'chrome',
      args: [
        '--disable-blink-features=AutomationControlled',
        '--no-sandbox'
      ],
      viewport: { width: 1280, height: 800 }
    });

    this.page = this.context.pages()[0] || await this.context.newPage();
    console.log("Indeed browser initialized");
  }

  async login(creds: CandidateCredentials, maxAttempts = 2): Promise<void> {
    if (!this.page) throw new Error("Page not initialized");

    // Check if already logged in
    console.log("Checking if already logged in to Indeed...");
    await this.page.goto("https://profile.indeed.com/", { waitUntil: "load", timeout: 45000 });
    await this.page.waitForTimeout(5000);
    
    const currentUrl = this.page.url();
    if (currentUrl.startsWith("https://profile.indeed.com")) {
        console.log("Already logged in! Skipping login flow.");
        return;
    } else {
        console.log(`Not logged in (Current URL: ${currentUrl}). Proceeding to login flow...`);
    }

    let attempt = 0;
    while (attempt < maxAttempts) {
      attempt++;
      try {
        console.log(`Indeed login attempt ${attempt}...`);
        await this.page.goto("https://www.indeed.com/", { waitUntil: "load", timeout: 60000 });
        
        console.log("Looking for 'Sign in' button...");
        const signInBtn = this.page.locator('a[data-gnav-element-name="SignIn"], a:has-text("Sign in")').first();
        await signInBtn.waitFor({ state: "visible", timeout: 20000 });
        await signInBtn.click();

        console.log("Waiting for login options...");
        const googleBtn = this.page.locator('button:has-text("Continue with Google"), #login-google-button').first();
        await googleBtn.waitFor({ state: "visible", timeout: 20000 });
        
        console.log("Clicking 'Continue with Google'...");
        const [popup] = await Promise.all([
            this.page.context().waitForEvent("page", { timeout: 60000 }), 
            googleBtn.click()
        ]);

        console.log("Google popup opened, handling auth...");
        await popup.waitForLoadState("load");
        await popup.waitForTimeout(5000); 

        // Account Picker vs Manual Login
        const accountChoice = popup.locator(`[data-email*="${creds.indeedEmail}"], [aria-label*="${creds.indeedEmail}"], li:has-text("${creds.indeedEmail}")`).first();

        if (await accountChoice.isVisible()) {
            console.log("Selecting existing Google account...");
            await accountChoice.click();
        } else {
            console.log("Performing manual Google login in popup...");
            const emailInput = popup.locator('input[type="email"], input[name="identifier"], #identifierId').first();
            await emailInput.waitFor({ state: "visible", timeout: 15000 });
            await emailInput.fill(creds.indeedEmail);
            await popup.locator('button:has-text("Next"), #identifierNext').first().click();
            
            const passInput = popup.locator('input[type="password"], input[name="password"]').first();
            await passInput.waitFor({ state: "visible", timeout: 20000 });
            await passInput.fill(creds.indeedPassword);
            await popup.locator('button:has-text("Next"), #passwordNext').first().click();
        }

        console.log("Waiting for login to complete...");
        try {
            await popup.waitForEvent("close", { timeout: 60000 });
        } catch (e) {
            console.log("Popup did not close automatically, continuing...");
        }

        // Verify login success
        await this.page.waitForSelector('button[aria-label="Account icon"], a[href*="profile"]', { timeout: 60000 });
        console.log("Indeed login successful!");
        return;

      } catch (err: any) {
        console.error(`Attempt ${attempt} failed: ${err.message}`);
        if (attempt >= maxAttempts) throw err;
        await this.page.reload().catch(() => {});
      }
    }
  }

  async updateResume(creds: CandidateCredentials): Promise<void> {
    if (!this.page) throw new Error("Page not initialized");

    try {
        console.log("Navigating to Profile...");
        await this.page.goto("https://profile.indeed.com/", { waitUntil: "load" });
        await this.page.waitForURL(/.*profile\.indeed\.com.*/, { timeout: 30000 });

        let resumePath: string | undefined = undefined;
        if (creds.resumeFilename) {
            resumePath = path.join(this.resumesDir, creds.resumeFilename);
        }

        if (!resumePath || !fs.existsSync(resumePath)) {
            console.log("Downloading current resume as fallback...");
            resumePath = await this.downloadCurrentResume(creds.indeedEmail);
        }

        console.log("Opening Resume section...");
        const resumeSection = this.page.locator('div.css-1e9y1g.e37uo190').first();
        await resumeSection.waitFor({ state: "visible", timeout: 15000 });
        await resumeSection.click();
        await this.page.waitForTimeout(2000);

        console.log("Triggering 'Replace file'...");
        const replaceBtn = this.page.locator('button:has-text("Replace file"), [data-testid="resume-replace-button"], [data-tn-element="replace-menu-btn"]').first();
        await replaceBtn.waitFor({ state: "attached", timeout: 10000 });
        
        const [fileChooser] = await Promise.all([
            this.page.waitForEvent("filechooser"),
            replaceBtn.evaluate((el: HTMLElement) => el.click()) // Use JS click as it's more reliable here
        ]);
        
        console.log(`Uploading: ${resumePath}`);
        await fileChooser.setFiles(resumePath);
        await this.page.waitForTimeout(5000);

        console.log("Confirming upload sequence...");
        const continueBtn = this.page.locator('button:has-text("Continue")').first();
        await continueBtn.waitFor({ state: "visible", timeout: 20000 });
        await continueBtn.click();
        
        const confirmBtn = this.page.locator('button:has-text("Upload this resume")').first();
        await confirmBtn.waitFor({ state: "visible", timeout: 20000 });
        await confirmBtn.click();
        
        const saveExitBtn = this.page.locator('button[data-tn-element="save-exit"], button:has-text("Save and exit")').first();
        await saveExitBtn.waitFor({ state: "visible", timeout: 20000 });
        await saveExitBtn.click();
        
        await this.page.waitForTimeout(3000);
        console.log("Indeed resume update successful!");

    } catch (err: any) {
        console.error(`Indeed update failed: ${err.message}`);
        await this.page.screenshot({ path: `indeed_update_failure_${creds.indeedEmail.split('@')[0]}.png` });
        throw err;
    }
  }

  private async downloadCurrentResume(email: string): Promise<string> {
    if (!this.page) throw new Error("Page not initialized");
    const resumeMenuBtn = this.page.locator('button[aria-label*="Resume menu"]').first();
    await resumeMenuBtn.click();
    const downloadBtn = this.page.locator('button:has-text("Download")').first();
    const [download] = await Promise.all([
        this.page.waitForEvent("download"),
        downloadBtn.click()
    ]);
    const downloadPath = path.join(this.tempDir, `indeed_current_${email.split("@")[0]}.pdf`);
    await download.saveAs(downloadPath);
    return downloadPath;
  }

  async close() {
    try {
      if (this.context) await this.context.close().catch(() => {});
    } catch {}
  }
}
