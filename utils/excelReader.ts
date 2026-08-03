import * as XLSX from 'xlsx';
import * as path from 'path';

export function getExcelData(filePath: string, sheetName: string = 'Sheet1'): any[] {
  const absolutePath = path.resolve(filePath);
  const workbook = XLSX.readFile(absolutePath);
  const worksheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json(worksheet);
}

export function writeExcelData(filePath: string, data: any[], sheetName: string = 'Sheet1') {
  const absolutePath = path.resolve(filePath);
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, absolutePath);
}
