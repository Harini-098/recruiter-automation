import { IndeedService } from "../src/indeedService.js";
import { ExcelHandler } from "../src/excelHandler.js";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
    const baseDir = __dirname;
    const excelHandler = new ExcelHandler(baseDir);
    const indeedService = new IndeedService(baseDir, { headless: false });

    try {
        const credentials = await excelHandler.readCredentials();
        const firstCandidate = credentials[0];

        if (!firstCandidate || !firstCandidate.indeedEmail) {
            console.error("No Indeed credentials found for the first candidate.");
            return;
        }

        console.log(`Testing Indeed login for: ${firstCandidate.indeedEmail}`);
        await indeedService.init();
        
        // Manual override for login to add more logging/screenshots
        console.log("Navigating to Indeed...");
        const page = (indeedService as any).page;
        await page.goto("https://www.indeed.com/", { waitUntil: "load" });
        await page.screenshot({ path: "test_indeed_1_home.png" });

        console.log("Starting login flow...");
        await indeedService.login(firstCandidate);
        
        console.log("Login successful! Proceeding to resume update...");
        await indeedService.updateResume(firstCandidate);
        
        console.log("Resume update successful! Keeping browser open for 10 seconds...");
        await new Promise(resolve => setTimeout(resolve, 10000));
        await page.screenshot({ path: "test_indeed_final_state.png" });

    } catch (err: any) {
        console.error("Test failed:", err.message);
        // IndeedService already takes a failure screenshot
    } finally {
        await indeedService.close();
    }
}

main();
