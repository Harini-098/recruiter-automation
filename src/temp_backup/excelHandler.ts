import * as ExcelJS from "exceljs";
import * as path from "path";
import * as fs from "fs";

export interface DiceCredentials {
    email: string;
    password: string;
    resumeFilename?: string;
}

export interface AutomationResult {
    email: string;
    status: "SUCCESS" | "FAILED";
    timestamp: string;
    message: string;
    screenshotPath?: string;
}

export class ExcelHandler {
    private readonly credentialsPath: string;
    private readonly resultsPath: string;

    constructor(baseDir: string) {
        this.credentialsPath = path.join(baseDir, "data.xlsx");
        this.resultsPath = path.join(baseDir, "automation_results.xlsx");
    }

    async readCredentials(): Promise<DiceCredentials[]> {
        if (!fs.existsSync(this.credentialsPath)) {
            throw new Error(`Credentials file not found at ${this.credentialsPath}`);
        }

        const workbook = new (ExcelJS as any).default.Workbook();
        await workbook.xlsx.readFile(this.credentialsPath);
        const worksheet = workbook.getWorksheet(1);
        const credentials: DiceCredentials[] = [];

        if (!worksheet) return [];

        worksheet.eachRow((row: any, rowNumber: number) => {
            if (rowNumber === 1) return;

            const email = row.getCell(1).text;
            const password = row.getCell(2).text;
            const resumeFilename = row.getCell(3).text;

            if (email && password) {
                credentials.push({
                    email,
                    password,
                    resumeFilename: resumeFilename || undefined
                });
            }
        });

        return credentials;
    }

    async writeResult(result: AutomationResult): Promise<void> {
        const workbook = new (ExcelJS as any).default.Workbook();
        let worksheet: any;

        if (fs.existsSync(this.resultsPath)) {
            await workbook.xlsx.readFile(this.resultsPath);
            worksheet = workbook.getWorksheet(1) || workbook.addWorksheet("Results");
        } else {
            worksheet = workbook.addWorksheet("Results");
            worksheet.columns = [
                { header: "Email", key: "email", width: 30 },
                { header: "Status", key: "status", width: 15 },
                { header: "Timestamp", key: "timestamp", width: 25 },
                { header: "Message", key: "message", width: 50 },
                { header: "Screenshot", key: "screenshotPath", width: 50 }
            ];
        }

        worksheet.addRow({
            email: result.email,
            status: result.status,
            timestamp: result.timestamp,
            message: result.message,
            screenshotPath: result.screenshotPath
        });

        await workbook.xlsx.writeFile(this.resultsPath);
    }
}
