// Excel Extractor - FORCE UPDATE FIX
import * as XLSX from 'xlsx';
import { SheetData, ProcessedSheet, ETLResult } from './types';
import { sanitizeColumnNames, sanitizeTableName } from './sanitizer';
import { cleanData, findDataStartRow } from './cleaner';
import { processEnrichmentPipeline } from './enrichment';
import { isMasterLoaded } from './masterData';
import {
  extractVD59TotalFromData,
  extractVD52TotalEkuitasFromData,
  calculateVD510NilaiRanking,
  resetCalculationState,
  updateVD59WithCalculatedData,
  updateVD58WithCalculatedData
} from './nilaiRankingCalculator';

const VD510_SHEET_PATTERN = /vd510|vd5[\-_]?10|formulir\s*10/i;
const VD59_SHEET_PATTERN = /vd59|vd5[\-_]?9|formulir\s*9/i;
const VD58_SHEET_PATTERN = /vd58|vd5[\-_]?8|formulir\s*8/i; // <--- Tambahkan ini
const VD52_SHEET_PATTERN = /vd52|vd5[\-_]?2|formulir\s*2/i;

const TABLE_10C_START = 'TABEL 10C';
const TABLE_10C_STOP_MARKERS = ['TABEL 10D', 'TABEL 10E', 'Apabila diperlukan'];

export async function extractFromExcel(file: File): Promise<ETLResult> {
  const result: ETLResult = {
    success: true,
    sheets: [],
    errors: [],
    warnings: [],
  };

  try {
    resetCalculationState();

    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });

    const allSheets: ProcessedSheet[] = [];
    let totalEkuitas: number = 0;
    let vd52Found = false;

    console.log('🚀 Starting Extraction Process...');

    // --- PASS 1: EXTRACT DATA & FIND TOTAL EKUITAS ---
    for (const sheetName of workbook.SheetNames) {
      try {
        const worksheet = workbook.Sheets[sheetName];
        let sheetData: SheetData;
        
        if (VD510_SHEET_PATTERN.test(sheetName)) {
          sheetData = extractVD510Special(worksheet, sheetName);
        } else {
          sheetData = extractStandard(worksheet, sheetName);
        }

        if (sheetData.rows.length === 0) continue;

        let processedSheet = processSheetData(sheetData, file.name);

        // Cek VD52 untuk ambil Total Ekuitas
        if (VD52_SHEET_PATTERN.test(sheetName)) {
          console.log(`📊 Detected VD52: "${sheetName}".`);
          const extractedVal = extractVD52TotalEkuitasFromData(processedSheet.data, processedSheet.headers);
          if (extractedVal > 0) {
            totalEkuitas = extractedVal;
            vd52Found = true;
          }
        }

        allSheets.push(processedSheet);
      } catch (sheetError) {
        result.warnings.push(`Gagal sheet "${sheetName}": ${sheetError}`);
      }
    }

    // --- PASS 2: CALCULATE VD510 ---
    console.log(`📊 Pass 2: Calc VD510 with Total Ekuitas = ${totalEkuitas}`);
    
    let grandTotalRankingLiabilities = 0; 

    for (let i = 0; i < allSheets.length; i++) {
      const sheet = allSheets[i];
      // Cek sheet VD510
      if (VD510_SHEET_PATTERN.test(sheet.tableName) || sheet.tableName.includes('TABEL_10C')) {
        
        const calculatedData = calculateVD510NilaiRanking(
          sheet.data,
          sheet.headers,
          totalEkuitas 
        );

        // Ambil Total Portofolio
        const totalRow = calculatedData.find(row => {
            const s = Object.values(row).map(v => String(v).toLowerCase()).join(' ');
            return s.includes('total portofolio milik') || s.includes('total portofolio');
        });

        if (totalRow) {
            const rankingKey = Object.keys(totalRow).find(k => 
                k.toLowerCase().includes('ranking') || k.toLowerCase().includes('liabilities')
            );
            if (rankingKey) grandTotalRankingLiabilities = Number(totalRow[rankingKey]) || 0;
        }

        allSheets[i] = { ...sheet, data: calculatedData };
        result.warnings.push(`VD510 Calc Done. Result: ${grandTotalRankingLiabilities.toLocaleString()}`);
      }
    }

// --- PASS 3: FORCE UPDATE VD59 & VD58 ---
    console.log("🔄 Pass 3: FORCING VD59 & VD58 UPDATE...");
    
    let vd59UpdatedCount = 0;
    
    // Kita gunakan variabel grandTotalRankingLiabilities yang sudah dihitung di Pass 2
    
    for (let i = 0; i < allSheets.length; i++) {
        const sheet = allSheets[i];
        
        // 1. UPDATE VD59 (LOGIKA LAMA - TETAP UTUH)
        if (VD59_SHEET_PATTERN.test(sheet.tableName)) {
            console.log(`⚡ UPDATING SHEET VD59: ${sheet.sheetName}`);
            
            const updatedVD59 = updateVD59WithCalculatedData(
                sheet.data,
                sheet.headers,
                grandTotalRankingLiabilities
            );

            allSheets[i] = { ...sheet, data: updatedVD59 };
            vd59UpdatedCount++;
            result.warnings.push(`✅ VD59 "${sheet.sheetName}" berhasil di-update paksa.`);
        }
        
        // 2. UPDATE VD58 (LOGIKA BARU - DITAMBAHKAN)
        else if (VD58_SHEET_PATTERN.test(sheet.tableName)) {
            console.log(`⚡ UPDATING SHEET VD58: ${sheet.sheetName}`);

            const updatedVD58 = updateVD58WithCalculatedData(
                sheet.data,
                sheet.headers,
                grandTotalRankingLiabilities
            );

            allSheets[i] = { ...sheet, data: updatedVD58 };
            result.warnings.push(`✅ VD58 "${sheet.sheetName}" berhasil di-update (Inject Nilai Ranking Liabilities).`);
        }
    }

    // Validasi tetap fokus ke VD59 karena itu mandatory
    if (vd59UpdatedCount === 0) {
        console.error("❌ ERROR: Tidak ada sheet VD59 yang ditemukan untuk di-update!");
        result.warnings.push("⚠️ Gagal Update: Sheet VD59 tidak ditemukan di Pass 3.");
    }


    result.sheets = allSheets;

    if (result.sheets.length === 0) {
      result.success = false;
      result.errors.push('No sheets processed');
    }

  } catch (error) {
    result.success = false;
    result.errors.push(`Extraction Failed: ${error}`);
  }

  return result;
}

// --- BAGIAN HELPER DI BAWAH JANGAN DIUBAH ---
function extractStandard(worksheet: XLSX.WorkSheet, sheetName: string): SheetData {
  const rawData = XLSX.utils.sheet_to_json<unknown[]>(worksheet, { header: 1, defval: null, blankrows: true });
  if (rawData.length === 0) return { sheetName, headers: [], rows: [], originalHeaders: [], rowCount: 0 };
  const dataStartRow = findDataStartRow(rawData);
  const headerRowIndex = Math.min(dataStartRow, rawData.length - 1);
  const headerRow = rawData[headerRowIndex] as (string | number | null)[];
  const { sanitizedHeaders } = sanitizeColumnNames(headerRow);
  const dataRows = rawData.slice(headerRowIndex + 1);
  const rows = dataRows.map((row) => {
    const rowArray = row as unknown[];
    const obj: Record<string, unknown> = {};
    sanitizedHeaders.forEach((header, idx) => { obj[header] = rowArray[idx] ?? null; });
    return obj;
  });
  return { sheetName, headers: sanitizedHeaders, originalHeaders: headerRow.map(h => String(h ?? '')), rows, rowCount: rows.length };
}

function extractVD510Special(worksheet: XLSX.WorkSheet, sheetName: string): SheetData {
  const rawData = XLSX.utils.sheet_to_json<unknown[]>(worksheet, { header: 1, defval: null, blankrows: true });
  let table10CStart = -1; let table10CEnd = rawData.length;
  for (let i = 0; i < rawData.length; i++) {
    const rowText = (rawData[i] as unknown[]).filter(c => c !== null && c !== undefined).map(c => String(c)).join(' ');
    if (table10CStart === -1 && rowText.toUpperCase().includes(TABLE_10C_START)) { table10CStart = i; continue; }
    if (table10CStart !== -1) {
      for (const stopMarker of TABLE_10C_STOP_MARKERS) {
        if (rowText.toUpperCase().includes(stopMarker.toUpperCase())) { table10CEnd = i; break; }
      }
      if (table10CEnd !== rawData.length) break;
    }
  }
  if (table10CStart === -1) return extractStandard(worksheet, sheetName);
  const headerRowIndex = table10CStart + 1;
  const headerRow = rawData[headerRowIndex] as (string | number | null)[];
  const { sanitizedHeaders } = sanitizeColumnNames(headerRow);
  const dataRows = rawData.slice(headerRowIndex + 1, table10CEnd);
  const rows = dataRows.map((row) => {
    const rowArray = row as unknown[];
    const obj: Record<string, unknown> = {};
    sanitizedHeaders.forEach((header, idx) => { obj[header] = rowArray[idx] ?? null; });
    return obj;
  });
  return { sheetName: `${sheetName}_TABEL_10C`, headers: sanitizedHeaders, originalHeaders: headerRow.map(h => String(h ?? '')), rows, rowCount: rows.length };
}



function processSheetData(sheetData: SheetData, fileName: string): ProcessedSheet {
  const { cleanedData, removedColumns } = cleanData(sheetData.rows, sheetData.headers);
  let finalHeaders = sheetData.headers.filter(h => !removedColumns.includes(h));
  let processedData = cleanedData;
  let enrichmentStats = null;
  if (isMasterLoaded()) {
    const enrichmentResult = processEnrichmentPipeline(cleanedData, finalHeaders);
    processedData = enrichmentResult.processedData;
    finalHeaders = enrichmentResult.newHeaders;
    enrichmentStats = enrichmentResult.stats;
  }
  if (VD510_SHEET_PATTERN.test(sheetData.sheetName)) {
    const nilaiRankingColumn = finalHeaders.find(h => {
      const lower = h.toLowerCase();
      return (lower.includes('nilai') || lower.includes('ranking')) && (lower.includes('rangking') || lower.includes('ranking') || lower.includes('liabilities'));
    });
    if (nilaiRankingColumn) { processedData = processedData.map(row => ({ ...row, [nilaiRankingColumn]: null })); }
  }
  const uploadDate = new Date().toISOString();
  return { sheetName: sheetData.sheetName, tableName: sanitizeTableName(sheetData.sheetName), headers: finalHeaders, data: processedData, metadata: { fileName, uploadDate, originalRowCount: sheetData.rowCount, cleanedRowCount: cleanedData.length, enrichmentStats } };
}

export function getSheetNames(file: File): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        resolve(workbook.SheetNames);
      } catch (error) { reject(error); }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}