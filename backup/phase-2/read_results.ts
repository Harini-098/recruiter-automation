import * as ExcelJS from "exceljs";
import * as path from "path";

async function main() {
    const workbook = new (ExcelJS as any).default.Workbook();
    await workbook.xlsx.readFile("automation_results.xlsx");
    const worksheet = workbook.getWorksheet(1);
    worksheet.eachRow((row, rowNumber) => {
        console.log(`Row ${rowNumber}: ${JSON.stringify(row.values)}`);
    });
}
main();
