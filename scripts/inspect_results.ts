import { ExcelHandler } from "../src/excelHandler.js";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
    const baseDir = path.join(__dirname, "..");
    const excelHandler = new ExcelHandler(baseDir);
    try {
        const resultsFile = path.join(baseDir, "data", "automation_results.xlsx");
        console.log(`Reading results from ${resultsFile}...`);
        // Since writeResult adds rows, we'll just read the file directly using exceljs to see all rows
        const ExcelJS = await import("exceljs");
        const workbook = new (ExcelJS as any).default.Workbook();
        await workbook.xlsx.readFile(resultsFile);
        const worksheet = workbook.getWorksheet(1);
        worksheet.eachRow((row, rowNumber) => {
            console.log(`Row ${rowNumber}: ${JSON.stringify(row.values)}`);
        });
    } catch (err) {
        console.error("Error reading results:", err);
    }
}

main();
