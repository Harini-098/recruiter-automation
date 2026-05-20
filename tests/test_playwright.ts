import { chromium } from "playwright";

async function main() {
    try {
        console.log("Launching browser...");
        const browser = await chromium.launch({ headless: true });
        console.log("Browser launched.");
        const page = await browser.newPage();
        console.log("Navigating to google.com...");
        await page.goto("https://www.google.com");
        console.log("Page title:", await page.title());
        await browser.close();
        console.log("Browser closed.");
    } catch (err) {
        console.error("Playwright failed:", err);
    }
}
main();
