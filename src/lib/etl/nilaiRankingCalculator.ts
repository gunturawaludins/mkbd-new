// Direct Nilai Ranking Liabilities Calculator
// Calculate and inject into VD510 data AFTER enrichment

export interface CalculationState {
  vd59TotalModalSendiri: number | null;
}

let calculationState: CalculationState = {
  vd59TotalModalSendiri: null,
};

/**
 * Helper to parse numbers robustly (handle Rp, dots, commas)
 */
function parseNumberRobust(value: unknown): number {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return value;

  let strVal = String(value).trim();
  
  // Handle parenthesis for negative values: (500) -> -500
  let isNegative = false;
  if (strVal.startsWith('(') && strVal.endsWith(')')) {
    isNegative = true;
    strVal = strVal.replace(/[()]/g, '');
  }

  // Remove currency symbols and non-numeric characters except . , -
  strVal = strVal.replace(/[^\d.,-]/g, '');

  if (!strVal) return 0;

  // Detect format: Indo (1.000,00) vs US (1,000.00)
  const lastComma = strVal.lastIndexOf(',');
  const lastDot = strVal.lastIndexOf('.');

  if (lastComma > lastDot) {
    // Indo format
    strVal = strVal.replace(/\./g, '').replace(',', '.');
  } else {
    // US format
    strVal = strVal.replace(/,/g, '');
  }

  const result = parseFloat(strVal);
  return isNaN(result) ? 0 : (isNegative ? -result : result);
}

/**
 * EXTRACT TOTAL ASET LANCAR FROM VD59
 */
export function extractVD59TotalFromData(
  data: Record<string, unknown>[],
  headers: string[]
): number {
  console.log('=== EXTRACTING VD59 TOTAL ASET LANCAR (ROBUST MODE) ===');
  
  let targetRow: Record<string, unknown> | undefined;

  for (const row of data) {
    const rowStr = Object.values(row).map(v => String(v || '').toUpperCase()).join(' ');
    if (rowStr.includes('TOTAL ASET LANCAR') || rowStr.includes('TOTAL AKTIVA LANCAR')) {
      targetRow = row;
      console.log('✅ Found row containing "TOTAL ASET LANCAR"');
      break;
    }
  }

  if (!targetRow) {
    console.warn('⚠️ Row dengan "TOTAL ASET LANCAR" tidak ditemukan di VD59');
    return 0;
  }

  let maxVal = 0;
  Object.values(targetRow).forEach(val => {
    const num = parseNumberRobust(val);
    if (num > maxVal) maxVal = num;
  });

  console.log(`💰 Extracted Max Value (Total Aset Lancar): ${maxVal.toLocaleString('id-ID')}`);
  console.log('=== VD59 EXTRACTION COMPLETE ===\n');

  calculationState.vd59TotalModalSendiri = maxVal;
  return maxVal;
}

/**
 * EXTRACT TOTAL EKUITAS FROM VD52
 */
export function extractVD52TotalEkuitasFromData(
  data: Record<string, unknown>[],
  headers: string[]
): number {
  console.log('=== EXTRACTING VD52 TOTAL EKUITAS (ROBUST MODE) ===');
  
  let targetRow: Record<string, unknown> | undefined;

  for (const row of data) {
    const rowStr = Object.values(row).map(v => String(v || '').toUpperCase()).join(' ');
    if (rowStr.includes('TOTAL EKUITAS')) {
      targetRow = row;
      console.log('✅ Found row containing "TOTAL EKUITAS"');
      break;
    }
  }

  if (!targetRow) {
    console.warn('⚠️ Row dengan "TOTAL EKUITAS" tidak ditemukan di VD52');
    return 0;
  }

  let maxVal = 0;
  Object.values(targetRow).forEach(val => {
    const num = parseNumberRobust(val);
    if (num > maxVal) maxVal = num;
  });

  console.log(`💰 Extracted Max Value (Total Ekuitas): ${maxVal.toLocaleString('id-ID')}`);
  console.log('=== VD52 EXTRACTION COMPLETE ===\n');

  return maxVal;
}

/**
 * CALCULATE VD510 RANKING LIABILITIES
 * Logic Updated:
 * 1. Check Persentase: If < 20% (0.2), Result = 0
 * 2. Else: Result = Grup Nilai Pasar Wajar - (20% * Total Ekuitas)
 */
export function calculateVD510NilaiRanking(
  data: Record<string, unknown>[],
  headers: string[],
  totalEkuitas: number
): Record<string, unknown>[] {
  console.log('=== CALCULATING VD510 NILAI RANGKING LIABILITIES ===');
  const pengurang = totalEkuitas * 0.2;
  console.log(`📉 Pengurang (20% Ekuitas): ${pengurang.toLocaleString('id-ID')}`);

  // 1. IDENTIFY COLUMNS
  
  // A. Target Output: Nilai Rangking Liabilities
  let nilaiRankingKey = headers.find(h => {
    const lower = h.toLowerCase();
    return (lower.includes('nilai') || lower.includes('ranking')) && 
           (lower.includes('rangking') || lower.includes('ranking') || lower.includes('liabilities'));
  });
  if (!nilaiRankingKey) nilaiRankingKey = 'Nilai Rangking Liabilities';

  // B. Input: Grup Nilai Pasar Wajar (Dari Enrichment)
  const GRUP_VAL_KEY = 'GRUP_NILAI_PASAR_WAJAR'; 

  // C. Input: Persentase (Untuk Cek < 0.2)
  const persentaseKey = headers.find(h => {
    const lower = h.toLowerCase();
    return lower.includes('persen') || lower.includes('%');
  });

  console.log(`🔍 Column Persentase found: ${persentaseKey || 'NONE'}`);

  // DEFINE PORTFOLIO MARKERS
  const portfolioTotalMarkers = [
    'portfolio tidak terkonsentrasi', 'total portfolio', 'total portofolio milik', 'total portofolio'
  ];

  // 1A. PRE-PROCESS: IDENTIFIKASI DUPLIKAT GRUP VALUE & HIGHEST PERSENTASE
  const grupPersentaseMap = new Map<number, { maxPersentase: number; selectedIdx: number }>();
  
  data.forEach((row, idx) => {
    const rowStr = Object.values(row).map(v => String(v || '').toLowerCase()).join(' ');
    
    // Skip portfolio & subtotal
    if (portfolioTotalMarkers.some(m => rowStr.includes(m)) || rowStr.includes('sub total')) {
      return;
    }

    // Ambil Grup Value
    let grupValue = 0;
    if (GRUP_VAL_KEY in row) {
      grupValue = parseNumberRobust(row[GRUP_VAL_KEY]);
    } else {
      const fallbackKey = Object.keys(row).find(k => k.includes('GRUP') && k.includes('NILAI'));
      if (fallbackKey) grupValue = parseNumberRobust(row[fallbackKey]);
    }

    if (grupValue === 0) return;

    // Ambil Persentase
    let persentase = 0;
    if (persentaseKey && row[persentaseKey] !== undefined) {
      persentase = parseNumberRobust(row[persentaseKey]);
    }

    // Update map: simpan persentase tertinggi untuk setiap grup
    if (!grupPersentaseMap.has(grupValue)) {
      grupPersentaseMap.set(grupValue, { maxPersentase: persentase, selectedIdx: idx });
    } else {
      const existing = grupPersentaseMap.get(grupValue)!;
      if (persentase > existing.maxPersentase) {
        existing.maxPersentase = persentase;
        existing.selectedIdx = idx;
      }
    }
  });

  console.log(`🔍 Duplikat Grup Value terdeteksi: ${grupPersentaseMap.size} grup unik`);
  for (const [grupVal, info] of grupPersentaseMap) {
    console.log(`   Grup ${grupVal.toLocaleString('id-ID')}: Max Persentase ${(info.maxPersentase * 100).toFixed(2)}% di index ${info.selectedIdx}`);
  }

  // 2. PROCESS ROWS
  let nilaiRankingSum = 0;
  let portfolioRowIndex = -1;

  const processedData = data.map((row, idx) => {
    const newRow = { ...row };
    const rowStr = Object.values(row).map(v => String(v || '').toLowerCase()).join(' ');
    
    // Cek baris total portofolio
    if (portfolioTotalMarkers.some(m => rowStr.includes(m))) {
      portfolioRowIndex = idx;
      (newRow as any)._isPortfolioTotal = true;
    } 
    else if (!rowStr.includes('sub total')) {
      
      // --- LOGIKA UTAMA ---
      
      // 1. Ambil Nilai Grup
      let grupValue = 0;
      if (GRUP_VAL_KEY in row) {
          grupValue = parseNumberRobust(row[GRUP_VAL_KEY]);
      } else {
          // Fallback search
          const fallbackKey = Object.keys(row).find(k => k.includes('GRUP') && k.includes('NILAI'));
          if (fallbackKey) grupValue = parseNumberRobust(row[fallbackKey]);
      }

      // 2. Ambil Persentase
      let persentase = 0;
      if (persentaseKey && row[persentaseKey] !== undefined) {
         let rawP = parseNumberRobust(row[persentaseKey]);
         persentase = rawP;
      }

      // --- KEPUTUSAN ---
      let calculatedValue = 0;

      // CEK DUPLIKAT GRUP: Apakah row ini yang dipilih (highest persentase)?
      const isSelectedForGrup = grupPersentaseMap.has(grupValue) && 
                                grupPersentaseMap.get(grupValue)!.selectedIdx === idx;

      // ATURAN 1: Jika bukan yang terpilih untuk grup yg sama, set 0
      if (grupValue > 0 && grupPersentaseMap.has(grupValue) && !isSelectedForGrup) {
          calculatedValue = 0;
          if (grupValue > 0) {
              console.log(`ℹ️ SKIP (DUPLIKAT GRUP): Entitas ini tidak terpilih untuk Grup ${grupValue.toLocaleString('id-ID')} (Persentase: ${(persentase * 100).toFixed(2)}%)`);
          }
      }
      // ATURAN 2: Jika Persentase < 20% (0.2), maka Risiko dianggap 0
      else if (persentase < 0.2) {
          calculatedValue = 0;
          
          // Debugging log jika ada saham yg kena skip
          if (grupValue > 0 && (rowStr.includes('dssa') || rowStr.includes('tkim'))) {
              console.log(`ℹ️ SKIP SAHAM ${rowStr.substring(0,10)}: Persentase ${persentase} < 0.2`);
          }

      } else {
          // ATURAN 3: Jika >= 20% dan terpilih, Hitung Rumus
          if (grupValue > 0) {
            calculatedValue = grupValue - pengurang;
            if (calculatedValue < 0) calculatedValue = 0;
          }
      }

      // Simpan Hasil
      if (nilaiRankingKey) newRow[nilaiRankingKey] = calculatedValue;
      nilaiRankingSum += calculatedValue;
    }
    return newRow;
  });

  // 3. Set Total Portofolio
  const finalData = processedData.map((row) => {
    if ((row as any)._isPortfolioTotal) {
      delete (row as any)._isPortfolioTotal;
      if (nilaiRankingKey) row[nilaiRankingKey] = nilaiRankingSum;
      
      const descCol = headers.find(h => h.toLowerCase().includes('uraian') || h.toLowerCase().includes('nama')) || headers[1];
      if (descCol) row[descCol] = 'TOTAL PORTOFOLIO MILIK (Nilai Rangking Liabilities)';
      
      console.log(`✅ TOTAL AKHIR SET: ${nilaiRankingSum.toLocaleString('id-ID')}`);
    }
    return row;
  });

  return finalData;
}

export function resetCalculationState(): void {
  calculationState.vd59TotalModalSendiri = null;
}
/**
 * ==========================================
 * NEW: UPDATE VD59 LOGIC (BRUTAL OVERWRITE ROW 20)
 * ==========================================
 * Solusi Akhir Baris 20:
 * Program akan menimpa SETIAP CELL di Baris 20 dengan nilai 773 M,
 * KECUALI cell yang berisi teks label ("Total Modal Kerja...").
 * Ini menjamin angka 1.442 T hilang dimanapun dia bersembunyi.
 */
export function updateVD59WithCalculatedData(
  vd59Data: Record<string, unknown>[],
  headers: string[],
  totalRankingLiabilities: number
): Record<string, unknown>[] {
  console.log('=== 🔨 UPDATING VD59 (BRUTAL OVERWRITE ROW 20) 🔨 ===');

  // --- 1. SETUP KOLOM ---
  let colJumlah = headers.find(h => h.trim().toUpperCase() === 'JUMLAH');
  if (!colJumlah) colJumlah = headers.find(h => h.toUpperCase().includes('JUMLAH'));
  
  if (!colJumlah) {
      const asetRow = vd59Data.find(r => Object.values(r).some(v => String(v).includes('1.919') || String(v).includes('1,919')));
      if (asetRow) {
         colJumlah = Object.keys(asetRow).find(k => String(asetRow[k]).replace(/[^0-9]/g,'').startsWith('1919'));
      }
  }

  let colTotal = headers.find(h => h.trim().toUpperCase() === 'TOTAL');
  if (!colTotal) colTotal = headers.find(h => h.toUpperCase().includes('TOTAL'));
  
  if (!colTotal && colJumlah) colTotal = headers[headers.length - 1]; 
  if (!colTotal && colJumlah) colTotal = colJumlah;

  if (!colJumlah) {
    console.error("❌ ERROR: Kolom data tidak ditemukan.");
    return vd59Data;
  }

  // --- 2. HITUNG BASE MODAL KERJA (773 M) ---
  let valAset = 0;
  let valLiab = 0;

  vd59Data.forEach(row => {
      const s = Object.values(row).map(v => String(v).toUpperCase()).join(' ');
      if (s.includes('TOTAL ASET LANCAR')) valAset = parseNumberRobust(row[colJumlah]);
      if (s.includes('TOTAL LIABILITAS') && !s.includes('RANKING')) valLiab = parseNumberRobust(row[colJumlah]);
  });

  const valBaseModalKerja = valAset - valLiab - totalRankingLiabilities;
  console.log(`🧮 NILAI MODAL KERJA (BASE): ${valBaseModalKerja.toLocaleString()}`);


  // --- 3. MAPPING INDEX BARIS ---
  let idxBaris20 = -1;       // TARGET UTAMA (Baris 18 di Excel)
  let idxMKBDAdjusted = -1; 
  let idxRequiredMKBD = -1; 
  let idxExcessMKBD = -1; 
  let idxMKBDHeader = -1;

  vd59Data.forEach((row, idx) => {
    const s = Object.values(row).map(v => String(v).toUpperCase()).join(' ');

    // Cari Baris 20: Ciri-cirinya ada kata "18" tapi tidak ada "15"
    if (s.includes('TOTAL MODAL KERJA BERSIH') && s.includes('18') && !s.includes('15')) {
        idxBaris20 = idx;
        console.log(`🎯 TARGET LOCKED: Baris 20 ditemukan di index ${idx}`);
    }

    if (s.includes('MODAL KERJA BERSIH DISESUAIKAN')) {
        if (idx < 50) idxMKBDHeader = idx; 
        else idxMKBDAdjusted = idx;        
    }
    if (s.includes('NILAI MKBD YANG DIWAJIBKAN') || s.includes('MKBD YANG DIWAJIBKAN')) idxRequiredMKBD = idx;
    if (s.includes('LEBIH (KURANG) MKBD') || (s.includes('LEBIH') && s.includes('KURANG'))) idxExcessMKBD = idx;
  });

  // Fallback MKBD Adjusted
  if (idxMKBDAdjusted === -1) {
      for (let i = vd59Data.length - 1; i > 50; i--) {
          const s = Object.values(vd59Data[i]).map(v => String(v).toUpperCase()).join(' ');
          if (s.includes('MODAL KERJA BERSIH DISESUAIKAN') || s.includes('MKBD')) {
              idxMKBDAdjusted = i;
              break;
          }
      }
  }


  // --- 4. HITUNG SUM POTONGAN RISIKO (30-90) ---
  let totalPotonganRisiko = 0;
  const startIndex = 29; 
  const endIndex = Math.min(89, vd59Data.length - 1); 

  console.log(`🔍 SUMMING ROWS (Index ${startIndex}-${endIndex})...`);

  for (let i = startIndex; i <= endIndex; i++) {
      if (!vd59Data[i]) continue;
      const row = vd59Data[i];
      const s = Object.values(row).map(v => String(v).toUpperCase()).join(' ');

      if (s.includes('MODAL KERJA BERSIH DISESUAIKAN') || s.trim() === '') continue;

      let val = 0;
      // Prioritas 1: Kolom Total
      if (colTotal) val = parseNumberRobust(row[colTotal]);
      // Prioritas 2: Kolom Jumlah
      if (val === 0 && colJumlah) val = parseNumberRobust(row[colJumlah]);
      
      // Prioritas 3: Scan Baris (Ambil angka terbesar)
      if (val === 0) {
          Object.values(row).forEach(v => {
              const num = parseNumberRobust(v);
              // Filter: Angka > 1000 (bukan nomor urut) dan < Base Modal (bukan salah copy)
              if (num > 1000 && num < valBaseModalKerja) { 
                   if (num !== 2024 && num !== 2025 && num !== 2026) {
                       if (num > val) val = num;
                   }
              }
          });
      }

      if (val > 0) totalPotonganRisiko += val;
  }
  
  console.log(`📉 TOTAL POTONGAN RISIKO: ${totalPotonganRisiko.toLocaleString()}`);
  
  // --- 4A. EXTRACT UTANG SUB-ORDINASI FROM VD59 ---
  let utangsubordinasi = 0;
  
  for (const row of vd59Data) {
    const rowStr = Object.values(row).map(v => String(v || '').toUpperCase()).join(' ');
    if (rowStr.includes('UTANG SUB-ORDINASI') || rowStr.includes('UTANG SUBORDINASI')) {
      utangsubordinasi = parseNumberRobust(row[colJumlah] || row[colTotal] || 0);
      console.log(`✅ Found UTANG SUB-ORDINASI: ${utangsubordinasi.toLocaleString('id-ID')}`);
      break;
    }
  }
  
  if (utangsubordinasi === 0) {
    console.warn('⚠️ Row dengan "UTANG SUB-ORDINASI" tidak ditemukan di VD59');
  }
  
  // --- 4B. CALCULATE TOTAL MODAL KERJA BERSIH (TMKBERSIH) ---
  const tmkbersih = valBaseModalKerja + utangsubordinasi;
  console.log(`🧮 TOTAL MODAL KERJA BERSIH (TMKBERSIH): ${tmkbersih.toLocaleString()}`);
  console.log(`   = Base Modal Kerja (${valBaseModalKerja.toLocaleString()}) + Utang Sub-Ordinasi (${utangsubordinasi.toLocaleString()})`);
  
  const valMKBDAdjusted = tmkbersih - totalPotonganRisiko;
  console.log(`🏁 HASIL MKBD DISESUAIKAN: ${valMKBDAdjusted.toLocaleString()}`);


  // --- 5. EKSEKUSI UPDATE DATA ---
  const updatedData = vd59Data.map((row, idx) => {
    const newRow = { ...row };
    const rowStr = Object.values(newRow).map(v => String(v).toUpperCase()).join(' | ');

    // A. Update Standard
    if (rowStr.includes('TOTAL RANKING LIABILITIES') && colJumlah) newRow[colJumlah] = totalRankingLiabilities;
    
    if ((rowStr.includes('TOTAL MODAL KERJA') && (rowStr.includes('DIKURANGI') || rowStr.includes('BARIS 9'))) || 
        (rowStr.includes('TOTAL MODAL KERJA') && rowStr.includes('BARIS 13'))) {
        if (colJumlah) newRow[colJumlah] = valBaseModalKerja;
    }

    if (rowStr.includes('TOTAL MODAL KERJA BERSIH') && rowStr.includes('15') && rowStr.includes('17')) {
        if (colJumlah) newRow[colJumlah] = valBaseModalKerja;
        if (colTotal && colTotal !== colJumlah) newRow[colTotal] = null;
    }
    
    // B. BARIS 20 (BRUTAL OVERWRITE)
    // "Harusnya dia juga 773..." -> OKE, KITA PAKSA SEMUA ANGKA DI SINI JADI 773.
    if (idx === idxBaris20) {
        // 1. Isi kolom resmi
        if (colTotal) newRow[colTotal] = valBaseModalKerja;
        if (colJumlah) newRow[colJumlah] = valBaseModalKerja;
        
        // 2. TIMPA SEMUA KOLOM LAIN
        Object.keys(newRow).forEach(key => {
            const val = newRow[key];
            const strVal = String(val);

            // JANGAN timpa Label Barisnya (Ciri: mengandung huruf teks panjang)
            // Label biasanya "TOTAL MODAL KERJA BERSIH..."
            if (strVal.includes('TOTAL MODAL') || strVal.includes('BARIS 18')) {
                return; // Skip, ini label
            }

            // SELAIN LABEL, CEK APAKAH INI KOLOM ANGKA/DINAMIS
            // Ciri:
            // - Nama kolom mengandung "YO_"
            // - ATAU isinya adalah angka (parseNumberRobust > 0)
            // - ATAU isinya mirip angka hantu "1.442..."
            
            const num = parseNumberRobust(val);
            const cleanStr = strVal.replace(/[^0-9]/g, '');

            if (key.startsWith('YO_') || num > 0 || cleanStr.startsWith('1442')) {
                // console.log(`   🔨 Overwriting column [${key}] value [${strVal}] -> ${valBaseModalKerja}`);
                newRow[key] = valBaseModalKerja;
            }
        });
    }

    // C. Update MKBD Disesuaikan
    if (idx === idxMKBDAdjusted) {
        if (colTotal) newRow[colTotal] = valMKBDAdjusted;
        if (colJumlah) newRow[colJumlah] = valMKBDAdjusted;
    }

    // D. Bersihkan Header
    if (idx === idxMKBDHeader) {
        if (colJumlah) newRow[colJumlah] = null;
        if (colTotal) newRow[colTotal] = null;
    }

    return newRow;
  });

  // --- 6. HITUNG LEBIH (KURANG) MKBD ---
  if (idxExcessMKBD !== -1 && idxRequiredMKBD !== -1) {
      let valRequired = 0;
      const reqRow = updatedData[idxRequiredMKBD];
      
      if (colTotal) valRequired = parseNumberRobust(reqRow[colTotal]);
      if (valRequired === 0 && colJumlah) valRequired = parseNumberRobust(reqRow[colJumlah]);
      
      if (valRequired === 0) {
          Object.values(reqRow).forEach(val => {
              const num = parseNumberRobust(val);
              if (num > 1000) valRequired = num;
          });
      }

      console.log(`⚠️ MKBD Diwajibkan: ${valRequired.toLocaleString()}`);

      const valExcess = valMKBDAdjusted - valRequired;
      console.log(`✅ LEBIH (KURANG) MKBD: ${valExcess.toLocaleString()}`);

      if (colTotal) updatedData[idxExcessMKBD][colTotal] = valExcess;
      if (colJumlah) updatedData[idxExcessMKBD][colJumlah] = valExcess;
  }

  return updatedData;
}