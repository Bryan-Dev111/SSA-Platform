/**
 * Client-side .xlsx download for supplier profile table exports (SheetJS / xlsx).
 */
import * as XLSX from 'xlsx';

const INVALID_SHEET_NAME_CHARS = /[:\\/?*[\]]/g;

export type ExportRow = Record<string, string | number | null | undefined>;

/** Build a safe Excel worksheet name (max 31 chars, no invalid characters). */
function safeSheetName(name: string): string {
  const cleaned = name.replace(INVALID_SHEET_NAME_CHARS, '_').trim();
  return (cleaned || 'Sheet1').slice(0, 31);
}

/**
 * Download a single sheet as .xlsx. `rows` should be plain objects; keys become column headers.
 */
export function downloadTableXlsx(fileBaseName: string, sheetName: string, rows: ExportRow[]): void {
  if (rows.length === 0) return;
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, safeSheetName(sheetName));
  const file =
    fileBaseName.toLowerCase().endsWith('.xlsx') ? fileBaseName : `${fileBaseName.replace(/\.xlsx$/i, '')}.xlsx`;
  XLSX.writeFile(wb, file);
}
