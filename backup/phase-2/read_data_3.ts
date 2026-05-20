import * as ExcelJS from "exceljs";
async function main() {
    try {
        const workbook = new (ExcelJS as any).default.Workbook();
        await workbook.xlsx.readFile("data_3.xlsx");
        const worksheet = workbook.getWorksheet(1);
        console.log(`Worksheet has ${worksheet.rowCount} rows.`);
        worksheet.eachRow((row, rowNumber) => {
            console.log(`Row ${rowNumber}: ${JSON.stringify(row.values)}`);
        });
    } catch (e) {
        console.error(e);
    }
}
main();
