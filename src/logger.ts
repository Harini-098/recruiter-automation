import { Page } from "playwright";
import * as path from "path";
import * as fs from "fs";

export type LogLevel = "INFO" | "WARN" | "ERROR" | "DEBUG";

export class Logger {
    private readonly baseDir: string;
    private readonly screenshotDir: string;
    private readonly logFile: string;

    constructor(baseDir: string) {
        this.baseDir = baseDir;
        this.screenshotDir = path.join(baseDir, "automation_reports", "screenshots");
        
        // Generate a session-based log file name with IST timestamp
        const sessionTimestamp = this.getISTTimestamp().replace(/[:.]/g, "-");
        this.logFile = path.join(baseDir, "automation_reports", `session_${sessionTimestamp}.log`);

        // Ensure directories exist
        [path.dirname(this.logFile), this.screenshotDir].forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        });
    }

    /**
     * Helper to get current time in IST (UTC+5:30)
     */
    private getISTTimestamp(): string {
        const date = new Date();
        // Offset for IST is 5.5 hours
        const istDate = new Date(date.getTime() + (5.5 * 60 * 60 * 1000));
        return istDate.toISOString().replace('Z', '') + "+05:30";
    }

    private formatMessage(level: LogLevel, service: string, message: string): string {
        const timestamp = this.getISTTimestamp();
        return `[${timestamp}] [${level}] [${service}] ${message}`;
    }

    private log(level: LogLevel, service: string, message: string) {
        const formatted = this.formatMessage(level, service, message);
        console.log(formatted);
        fs.appendFileSync(this.logFile, formatted + "\n");
    }

    info(service: string, message: string) {
        this.log("INFO", service, message);
    }

    warn(service: string, message: string) {
        this.log("WARN", service, message);
    }

    error(service: string, message: string) {
        this.log("ERROR", service, message);
    }

    debug(service: string, message: string) {
        this.log("DEBUG", service, message);
    }

    async captureScreenshot(page: Page | null, service: string, name: string): Promise<string | null> {
        if (!page) return null;
        
        const timestamp = this.getISTTimestamp().replace(/[:.+]/g, "-");
        const filename = `${service}_${name}_${timestamp}.png`.toLowerCase().replace(/\s+/g, "_");
        const filePath = path.join(this.screenshotDir, filename);

        try {
            await page.screenshot({ path: filePath, fullPage: true });
            this.info(service, `Screenshot saved: ${filename}`);
            return filePath;
        } catch (err: any) {
            this.error(service, `Failed to capture screenshot: ${err.message}`);
            return null;
        }
    }
}
