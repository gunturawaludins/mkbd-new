// Test Data Generator - untuk debugging dan testing cross-table calculations

import * as XLSX from 'xlsx';

export function createTestVD59VD510File(): Blob {
  const workbook = XLSX.utils.book_new();

  // Create VD59 Sheet
  const vd59Data = [
    ['KODE', 'URAIAN', 'JUMLAH'],
    ['A', 'Liabilitas Jangka Pendek', 100000],
    ['B', 'Liabilitas Jangka Panjang', 200000],
    ['C', 'TOTAL MODAL KERJA BERSIH (BARIS 15 DITAMBAH BARIS 17)', 150000],
    ['D', 'Modal Disetor', 50000],
  ];

  const vd59Sheet = XLSX.utils.aoa_to_sheet(vd59Data);
  XLSX.utils.book_append_sheet(workbook, vd59Sheet, 'VD59');

  // Create VD510 Sheet - dengan persentase column
  const vd510Data = [
    ['KODE', 'NAMA_INSTRUMEN', 'GRUP_NILAI_PASAR_WAJAR', 'PERSENTASE_NILAI_PASAR_WAJAR', 'NILAI_RANGKING_LIABILITIES'],
    ['001', 'Instrumen 1', 500000, '33.33', 0],
    ['002', 'Instrumen 2', 300000, '20.00', 0],
    ['003', 'Instrumen 3', 1000000, '66.67', 0],
    ['004', 'Instrumen dengan Persentase 0', 100000, '0.00', 0], // Persentase 0 -> Nilai = 0
    ['005', 'Instrumen dengan Persentase -', 200000, '-', 0],     // Persentase - -> Nilai = 0
    ['SUB_A', 'Sub Total A', 0, '-', 0],  // Total row -> strip
    ['SUB_B', 'Sub Total B', 0, '-', 0],  // Total row -> strip
    ['SUB_D', 'Sub Total D', 0, '-', 0],  // Total row -> strip
    ['PORT', 'Portfolio Tidak Terkonsentrasi', 0, '-', 0], // Total row -> strip
  ];

  const vd510Sheet = XLSX.utils.aoa_to_sheet(vd510Data);
  XLSX.utils.book_append_sheet(workbook, vd510Sheet, 'VD510');

  // Convert to blob
  const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  return new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

export function logExpectedCalculations(): void {
  console.log('=== EXPECTED CALCULATIONS (TEST DATA) ===');
  console.log('Total Modal Sendiri (from VD59): 150,000');
  console.log('');
  console.log('For VD510 rows:');
  console.log('Row 1 (Instrumen 1): Persentase=33.33% → 500,000 - (20% × 150,000) = 470,000');
  console.log('Row 2 (Instrumen 2): Persentase=20.00% → 300,000 - (20% × 150,000) = 270,000');
  console.log('Row 3 (Instrumen 3): Persentase=66.67% → 1,000,000 - (20% × 150,000) = 970,000');
  console.log('Row 4 (Persentase 0): Persentase=0.00% → 0 (NOT CALCULATED)');
  console.log('Row 5 (Persentase -): Persentase="-" → 0 (NOT CALCULATED)');
  console.log('Row 6 (Sub Total A): TOTAL ROW → NULL/EMPTY (STRIPPED)');
  console.log('Row 7 (Sub Total B): TOTAL ROW → NULL/EMPTY (STRIPPED)');
  console.log('Row 8 (Sub Total D): TOTAL ROW → NULL/EMPTY (STRIPPED)');
  console.log('Row 9 (Portfolio): TOTAL ROW → NULL/EMPTY (STRIPPED)');
  console.log('=========================');
}
