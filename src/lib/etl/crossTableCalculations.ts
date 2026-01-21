// Cross-Table Calculations Module
// Handles calculations that require data from multiple tables (VD59, VD510, etc.)

import { parseNumericValue } from './enrichment';
import { updateRecordsWithCalculations } from './database';

/**
 * Extract Total Aset Lancar from VD59 data
 * Looks for row containing "TOTAL ASET LANCAR"
 * and returns the JUMLAH (total) column value
 */
export function extractTotalModalSendiriFromVD59(
  vd59Data: Record<string, unknown>[],
  vd59Headers: string[]
): number {
  if (!vd59Data || vd59Data.length === 0) {
    console.warn('VD59 data not available');
    return 0;
  }

  console.log('=== VD59 EXTRACTION START ===');
  console.log('VD59 Headers:', vd59Headers);
  console.log('VD59 Data rows count:', vd59Data.length);

  // Find JUMLAH column (as specified: KOLOM JUMLAH)
  const jumlahColumn = vd59Headers.find(h => {
    const lower = h.toLowerCase();
    return lower === 'jumlah' || lower.includes('_jumlah') || lower === 'total';
  });

  console.log('Looking for JUMLAH column, found:', jumlahColumn);

  if (!jumlahColumn) {
    console.warn('JUMLAH column not found in VD59 headers:', vd59Headers);
    return 0;
  }

  // Find row containing "TOTAL ASET LANCAR"
  console.log('Searching for target row with "TOTAL ASET LANCAR"');

  const targetRow = vd59Data.find((row, idx) => {
    const rowText = Object.values(row)
      .map(v => String(v).toLowerCase())
      .join(' ');

    if (idx < 5 || idx === vd59Data.length - 1) {
      console.log(`Row ${idx}: ${rowText.substring(0, 80)}...`);
    }

    return rowText.includes('total aset lancar') ||
           rowText.includes('total aktiva lancar');
  });

  if (!targetRow) {
    console.warn('Target row "TOTAL ASET LANCAR" not found in VD59 data');
    console.log('All VD59 rows:', vd59Data.map((r, i) => `${i}: ${JSON.stringify(r).substring(0, 100)}`));
    return 0;
  }

  console.log('Target row found:', targetRow);

  const totalValue = targetRow[jumlahColumn];
  const parsed = parseNumericValue(totalValue);
  
  console.log(`Extracted from column "${jumlahColumn}": ${totalValue} → ${parsed}`);
  console.log('=== VD59 EXTRACTION END ===');
  
  return parsed;
}

/**
 * Calculate Nilai Rangking Liabilities for VD510
 * Formula: GRUP Nilai Pasar Wajar - (20% x Total Modal Sendiri)
 * 
 * @param grupNilaiPasarWajar - The GRUP Nilai Pasar Wajar value from VD510
 * @param totalModalSendiri - Total Modal Sendiri value extracted from VD59
 * @returns Calculated value
 */
export function calculateNilaiRankingLiabilities(
  grupNilaiPasarWajar: number,
  totalModalSendiri: number
): number {
  const adjustment = 0.2 * totalModalSendiri; // 20% of Total Modal Sendiri
  return grupNilaiPasarWajar - adjustment;
}

/**
 * Process VD510 data to add calculated Nilai Rangking Liabilities column
 * This should be called after both VD59 and VD510 data have been extracted
 */
export function processVD510WithNilaiRanking(
  vd510Data: Record<string, unknown>[],
  vd510Headers: string[],
  vd59Data: Record<string, unknown>[],
  vd59Headers: string[]
): {
  processedData: Record<string, unknown>[];
  newHeaders: string[];
  warnings: string[];
} {
  const warnings: string[] = [];

  console.log('=== VD510 PROCESSING START ===');
  console.log('VD510 Headers:', vd510Headers);
  console.log('VD510 Data rows count:', vd510Data.length);

  // Extract Total Modal Sendiri from VD59
  const totalModalSendiri = extractTotalModalSendiriFromVD59(vd59Data, vd59Headers);
  
  console.log('Total Modal Sendiri extracted:', totalModalSendiri);

  if (totalModalSendiri === 0) {
    warnings.push('Gagal mengekstrak Total Modal Sendiri dari VD59. Kolom Nilai Rangking Liabilities tidak dihitung.');
    console.warn('WARNING: Total Modal Sendiri is 0!');
  }

  // Find relevant columns in VD510 - more flexible search
  const grupNilaiPasarWajarColumn = vd510Headers.find(h => {
    const lower = h.toLowerCase();
    return lower.includes('grup_nilai_pasar') || 
           lower.includes('grup nilai pasar') || 
           lower.includes('grupnilaipasar') ||
           lower === 'grup_nilai_pasar_wajar' ||
           lower === 'grup_nilai_pasar';
  });

  const nilaiRankingColumn = vd510Headers.find(h => {
    const lower = h.toLowerCase();
    return lower.includes('nilai_rangking_liabilities') ||
           lower.includes('nilai rangking liabilities') ||
           lower.includes('nilairangkingliabilities') ||
           lower.includes('nilai_ranking_liabilities') ||
           lower.includes('nilai ranking liabilities') ||
           lower === 'nilai_rangking_liabilities' ||
           lower === 'nilai_ranking_liabilities' ||
           (lower.includes('rangking') && lower.includes('liabilities')) ||
           (lower.includes('ranking') && lower.includes('liabilities'));
  });

  console.log('Found Grup Nilai Pasar Wajar column:', grupNilaiPasarWajarColumn);
  console.log('Found Nilai Rangking Liabilities column:', nilaiRankingColumn);

  if (!grupNilaiPasarWajarColumn) {
    warnings.push('Kolom "Grup Nilai Pasar Wajar" tidak ditemukan di VD510');
    console.warn('WARNING: Grup Nilai Pasar Wajar column not found!');
  }

  if (!nilaiRankingColumn) {
    warnings.push('Kolom "Nilai Rangking Liabilities" tidak ditemukan di VD510');
    console.warn('WARNING: Nilai Rangking Liabilities column not found!');
  }

  // Process each row
  const processedData = vd510Data.map((row, rowIndex) => {
    const newRow = { ...row };

    if (grupNilaiPasarWajarColumn && nilaiRankingColumn && totalModalSendiri > 0) {
      const grupValue = parseNumericValue(row[grupNilaiPasarWajarColumn]);
      const calculatedValue = calculateNilaiRankingLiabilities(grupValue, totalModalSendiri);
      
      // Update the existing column with calculated value
      newRow[nilaiRankingColumn] = calculatedValue;
      
      if (rowIndex < 3) {
        console.log(`Row ${rowIndex}: GRUP=${grupValue}, Modal=${totalModalSendiri}, Calculated=${calculatedValue}`);
        console.log(`  Before: ${row[nilaiRankingColumn]}`);
        console.log(`  After: ${calculatedValue}`);
      }
    } else {
      if (rowIndex < 3) {
        console.log(`Row ${rowIndex}: SKIPPED - Missing columns or total modal = 0`);
      }
    }

    return newRow;
  });

  // Return new headers
  const newHeaders = [...vd510Headers];

  console.log('=== VD510 PROCESSING END ===');
  console.log('Total rows processed:', processedData.length);

  return {
    processedData,
    newHeaders,
    warnings,
  };
}

/**
 * Get data from database and calculate cross-table values
 * This is useful when processing stored data
 */
export function calculateWithStoredData(
  vd510Rows: Record<string, unknown>[],
  vd510Headers: string[],
  vd59Rows: Record<string, unknown>[],
  vd59Headers: string[]
): Record<string, unknown>[] {
  const { processedData, warnings } = processVD510WithNilaiRanking(
    vd510Rows,
    vd510Headers,
    vd59Rows,
    vd59Headers
  );

  if (warnings.length > 0) {
    console.warn('Cross-table calculation warnings:', warnings);
  }

  return processedData;
}
