import { ExcelHandler } from "./excelHandler.js";
import { DiceService } from "./diceService.js";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
    const baseDir = path.join(__dirname, "..");
    const excelHandler = new ExcelHandler(baseDir);
    const diceService = new DiceService(baseDir);

    console.log("?? Starting Dice Automation (No Screenshots)...");

    try {
        const credentials = await excelHandler.readCredentials();
        console.log(`Found ${credentials.length} accounts to process.`);

        for (const creds of credentials) {
            console.log(`\n--- Processing: ${creds.email} ---`);
            
            try {
                await diceService.init();
                await diceService.login(creds);
                await diceService.updateResume(creds);

                await excelHandler.writeResult({
                    email: creds.email,
                    status: "SUCCESS",
                    timestamp: new Date().toLocaleString(),
                    message: "Resume updated successfully"
                });

                console.log(`? Finished ${creds.email}`);
            } catch (err: any) {
                console.error(`? Error for ${creds.email}:`, err.message);
                
                await excelHandler.writeResult({
                    email: creds.email,
                    status: "FAILED",
                    timestamp: new Date().toLocaleString(),
                    message: err.message
                });
            } finally {
                await diceService.close();
            }
        }
    } catch (err: any) {
        console.error("Fatal Error:", err.message);
    }

    console.log("\n?? Automation finished. Check automation_results.xlsx for details.");
}

main();
