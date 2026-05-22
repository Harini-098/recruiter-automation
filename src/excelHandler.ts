import * as ExcelJS from "exceljs";
import * as path from "path";
import * as fs from "fs";

export interface CandidateCredentials {
    name: string;
    diceEmail: string;
    dicePassword: string;
    monsterEmail: string;
    monsterPassword: string;
    indeedEmail: string;
    indeedPassword: string;
    resumeFilename?: string;
}

export interface AutomationResult {
    email: string;
    status: "SUCCESS" | "FAILED";
    timestamp: string;
    message: string;
}

export class ExcelHandler {
    private readonly credentialsPath: string;
    private readonly resultsPath: string;

    constructor(baseDir: string) {
        this.credentialsPath = path.join(baseDir, "data", "data.xlsx");
        this.resultsPath = path.join(baseDir, "data", "automation_results.xlsx");
    }

    async readCredentials(): Promise<CandidateCredentials[]> {
        if (!fs.existsSync(this.credentialsPath)) {
            throw new Error(`Credentials file not found at ${this.credentialsPath}`);
        }

        const workbook = new (ExcelJS as any).default.Workbook();
        await workbook.xlsx.readFile(this.credentialsPath);
        const worksheet = workbook.getWorksheet(1);
        const credentials: CandidateCredentials[] = [];

        if (!worksheet) return [];

        worksheet.eachRow((row: any, rowNumber: number) => {
            if (rowNumber === 1) return;

            const getCellText = (col: number) => {
                const cell = row.getCell(col);
                if (!cell) return "";
                const val = cell.value;
                if (val === null || val === undefined) return "";
                
                // If it's a hyperlink or object with a text property
                if (typeof val === "object") {
                    // Check for hyperlink structure: { text: '...', hyperlink: '...' }
                    if ((val as any).text !== undefined) {
                        return String((val as any).text).trim();
                    }
                    // Check for richText structure
                    if ((val as any).richText && Array.isArray((val as any).richText)) {
                        return (val as any).richText.map((t: any) => t.text || "").join("").trim();
                    }
                    // Check for formula result
                    if ((val as any).result !== undefined) {
                        return String((val as any).result).trim();
                    }
                    // Fallback: stringify and hope for the best, or just String()
                    return String(val).trim();
                }
                
                return String(val).trim();
            };

            const name = getCellText(1);
            const diceEmail = getCellText(2);
            const dicePassword = getCellText(3);
            const monsterEmail = getCellText(4);
            const monsterPassword = getCellText(5);
            const indeedEmail = getCellText(6);
            const indeedPassword = getCellText(7);
            const resumeFilename = getCellText(8);

            if (diceEmail || monsterEmail || indeedEmail) {
                credentials.push({
                    name: name || "Unknown",
                    diceEmail: diceEmail === "undefined" ? "" : diceEmail,
                    dicePassword: dicePassword === "undefined" ? "" : dicePassword,
                    monsterEmail: monsterEmail === "undefined" ? "" : monsterEmail,
                    monsterPassword: monsterPassword === "undefined" ? "" : monsterPassword,
                    indeedEmail: indeedEmail === "undefined" ? "" : indeedEmail,
                    indeedPassword: indeedPassword === "undefined" ? "" : indeedPassword,
                    resumeFilename: (resumeFilename === "undefined" || !resumeFilename) ? undefined : resumeFilename
                });
            }
        });

        return credentials;
    }

    async writeResult(result: AutomationResult, retries = 3, delay = 2000): Promise<void> {
        let lastError: any;
        
        for (let i = 0; i < retries; i++) {
            try {
                const workbook = new (ExcelJS as any).default.Workbook();
                let worksheet: any;

                if (fs.existsSync(this.resultsPath)) {
                    await workbook.xlsx.readFile(this.resultsPath);
                    worksheet = workbook.getWorksheet(1) || workbook.addWorksheet("Results");
                } else {
                    worksheet = workbook.addWorksheet("Results");
                }

                // Always ensure columns are defined for key-based addRow to work
                worksheet.columns = [
                    { header: "Email", key: "email", width: 30 },
                    { header: "Status", key: "status", width: 15 },
                    { header: "Timestamp", key: "timestamp", width: 25 },
                    { header: "Message", key: "message", width: 50 }
                ];

                worksheet.addRow({
                    email: result.email,
                    status: result.status,
                    timestamp: result.timestamp,
                    message: result.message
                });

                await workbook.xlsx.writeFile(this.resultsPath);
                console.log(`Results saved to ${this.resultsPath}`);
                return; // Success
            } catch (err: any) {
                lastError = err;
                if (err.message.includes("EBUSY") || err.message.includes("permission denied")) {
                    console.warn(`[Excel] File locked, retrying in ${delay}ms... (${i + 1}/${retries})`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                } else {
                    throw err; // Non-lock error
                }
            }
        }
        
        throw new Error(`Failed to write to Excel after ${retries} attempts: ${lastError?.message}`);
    }
}
