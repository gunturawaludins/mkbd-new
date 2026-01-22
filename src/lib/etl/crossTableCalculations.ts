// Cross-Table Calculations Module
// Handles calculations that require data from multiple tables (VD59, VD510, etc.)

import { parseNumericValue } from './enrichment';
import { updateRecordsWithCalculations } from './database';

/**
 * Extract Total Ekuitas from VD52 data
 * Looks for row containing "TOTAL EKUITAS"
 * and returns the JUMLAH (total) column value
 */
export function extractTotalEkuitasFromVD52(
  vd52Data: Record<string, unknown>[],
  vd52Headers: string[]
): number {
  if (!vd52Data || vd52Data.length === 0) {
    console.warn('VD52 data not available');
    return 0;
  }

  console.log('=== VD52 EXTRACTION START ===');
  console.log('VD52 Headers:', vd52Headers);
  console.log('VD52 Data rows count:', vd52Data.length);

  // Find JUMLAH column (as specified: KOLOM JUMLAH)
  const jumlahColumn = vd52Headers.find(h => {
    const lower = h.toLowerCase();
    return lower === 'jumlah' || lower.includes('_jumlah') || lower === 'total';
  });

  console.log('Looking for JUMLAH column, found:', jumlahColumn);

  if (!jumlahColumn) {
    console.warn('JUMLAH column not found in VD52 headers:', vd52Headers);
    return 0;
  }

  // Find row containing "TOTAL EKUITAS"
  console.log('Searching for target row with "TOTAL EKUITAS"');

  const targetRow = vd52Data.find((row, idx) => {
    const rowText = Object.values(row)
      .map(v => String(v).toLowerCase())
      .join(' ');

    if (idx < 5 || idx === vd52Data.length - 1) {
      console.log(`Row ${idx}: ${rowText.substring(0, 80)}...`);
    }

    return rowText.includes('total ekuitas');
  });

  if (!targetRow) {
    console.warn('Target row "TOTAL EKUITAS" not found in VD52 data');
    console.log('All VD52 rows:', vd52Data.map((r, i) => `${i}: ${JSON.stringify(r).substring(0, 100)}`));
    return 0;
  }

  console.log('Target row found:', targetRow);

  const totalValue = targetRow[jumlahColumn];
  const parsed = parseNumericValue(totalValue);
  
  console.log(`Extracted from column "${jumlahColumn}": ${totalValue} → ${parsed}`);
  console.log('=== VD52 EXTRACTION END ===');
  
  return parsed;
}

/**
 * Extract Total Aset Lancar from VD59 data (LEGACY - kept for backward compatibility)
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

  console.log('=== VD59 EXTRACTION START (LEGACY) ===');
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
  console.log('=== VD59 EXTRACTION END (LEGACY) ===');
  
  return parsed;
}

/**
 * Calculate Nilai Rangking Liabilities for VD510
 * Formula: GRUP Nilai Pasar Wajar - (20% x Total Ekuitas)
 * 
 * @param grupNilaiPasarWajar - The GRUP Nilai Pasar Wajar value from VD510
 * @param totalEkuitas - Total Ekuitas value extracted from VD52
 * @returns Calculated value
 */
export function calculateNilaiRankingLiabilities(
  grupNilaiPasarWajar: number,
  totalEkuitas: number
): number {
  const adjustment = 0.2 * totalEkuitas; // 20% of Total Ekuitas
  return grupNilaiPasarWajar - adjustment;
}

/**
 * Process VD510 data to add calculated Nilai Rangking Liabilities column
 * This should be called after both VD52 and VD510 data have been extracted
 * Uses Total Ekuitas from VD52 as the base calculation value
 */
export function processVD510WithNilaiRanking(
  vd510Data: Record<string, unknown>[],
  vd510Headers: string[],
  vd52Data: Record<string, unknown>[],
  vd52Headers: string[]
): {
  processedData: Record<string, unknown>[];
  newHeaders: string[];
  warnings: string[];
} {
  const warnings: string[] = [];

  console.log('=== VD510 PROCESSING START ===');
  console.log('VD510 Headers:', vd510Headers);
  console.log('VD510 Data rows count:', vd510Data.length);

  // Extract Total Ekuitas from VD52
  const totalEkuitas = extractTotalEkuitasFromVD52(vd52Data, vd52Headers);
  
  console.log('Total Ekuitas extracted:', totalEkuitas);

  if (totalEkuitas === 0) {
    warnings.push('Gagal mengekstrak Total Ekuitas dari VD52. Kolom Nilai Rangking Liabilities tidak dihitung.');
    console.warn('WARNING: Total Ekuitas is 0!');
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

    if (grupNilaiPasarWajarColumn && nilaiRankingColumn && totalEkuitas > 0) {
      const grupValue = parseNumericValue(row[grupNilaiPasarWajarColumn]);
      const calculatedValue = calculateNilaiRankingLiabilities(grupValue, totalEkuitas);
      
      // Update the existing column with calculated value
      newRow[nilaiRankingColumn] = calculatedValue;
      
      if (rowIndex < 3) {
        console.log(`Row ${rowIndex}: GRUP=${grupValue}, Ekuitas=${totalEkuitas}, Calculated=${calculatedValue}`);
        console.log(`  Before: ${row[nilaiRankingColumn]}`);
        console.log(`  After: ${calculatedValue}`);
      }
    } else {
      if (rowIndex < 3) {
        console.log(`Row ${rowIndex}: SKIPPED - Missing columns or total ekuitas = 0`);
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
 * Now uses VD52 Total Ekuitas instead of VD59
 */
export function calculateWithStoredData(
  vd510Rows: Record<string, unknown>[],
  vd510Headers: string[],
  vd52Rows: Record<string, unknown>[],
  vd52Headers: string[]
): Record<string, unknown>[] {
  const { processedData, warnings } = processVD510WithNilaiRanking(
    vd510Rows,
    vd510Headers,
    vd52Rows,
    vd52Headers
  );

  if (warnings.length > 0) {
    console.warn('Cross-table calculation warnings:', warnings);
  }

  return processedData;
}
