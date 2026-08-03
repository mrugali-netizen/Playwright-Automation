import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';

export default async function globalTeardown() {
  const testDataDir = path.resolve('TestData');
  const consolidatedPath = path.join(testDataDir, 'OutputAnswers.xlsx');

  // Find all output files matching OutputAnswers_*.xlsx
  const files = fs.readdirSync(testDataDir).filter(f => f.startsWith('OutputAnswers_') && f.endsWith('.xlsx'));
  
  if (files.length === 0) {
    console.log('No browser-specific answers spreadsheets found to merge.');
    return;
  }

  console.log(`Found ${files.length} browser-specific output files. Starting consolidation...`);

  let mergedData: any[] = [];

  for (const file of files) {
    const filePath = path.join(testDataDir, file);
    const browserName = file.replace('OutputAnswers_', '').replace('.xlsx', '');
    
    // Map internal browser names to clean report column headings
    let columnHeader = 'Chrome_Answer';
    if (browserName === 'firefox') columnHeader = 'Firefox_Answer';
    if (browserName === 'webkit') columnHeader = 'Webkit_Answer';

    const workbook = XLSX.readFile(filePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet) as any[];

    if (mergedData.length === 0) {
      // First file: initialize the dataset with User_Message and the first answer column
      mergedData = rows.map(r => ({
        User_Message: r.User_Message,
        [columnHeader]: r[columnHeader] || ''
      }));
    } else {
      // Subsequent files: map answers matching the User_Message row index
      rows.forEach((r, idx) => {
        if (mergedData[idx]) {
          mergedData[idx][columnHeader] = r[columnHeader] || '';
        }
      });
    }
  }

  // Write the consolidated spreadsheet
  const worksheet = XLSX.utils.json_to_sheet(mergedData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
  XLSX.writeFile(workbook, consolidatedPath);
  console.log(`Consolidated output spreadsheet saved at: ${consolidatedPath}`);

  // Delete the temporary browser-specific spreadsheets
  for (const file of files) {
    const tempFilePath = path.join(testDataDir, file);
    try {
      fs.unlinkSync(tempFilePath);
      console.log(`Removed temporary file: ${file}`);
    } catch (err) {
      console.error(`Failed to delete temporary file ${file}:`, err);
    }
  }
}
