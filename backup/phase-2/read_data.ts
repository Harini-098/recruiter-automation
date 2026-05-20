import * as ExcelJS from "exceljs";

async function main() {
    const workbook = new (ExcelJS as any).default.Workbook();
    await workbook.xlsx.readFile("data.xlsx");
    const worksheet = workbook.getWorksheet(1);
    console.log(`Worksheet has ${worksheet.rowCount} rows.`);
    worksheet.eachRow((row, rowNumber) => {
        console.log(`Row ${rowNumber}: ${JSON.stringify(row.values)}`);
    });
}
main();
