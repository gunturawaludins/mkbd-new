import { describe, it, expect } from 'vitest';
import { extractVD59TotalFromData, extractVD52TotalEkuitasFromData, calculateVD510NilaiRanking } from '../lib/etl/nilaiRankingCalculator';

describe('Nilai Ranking Calculator', () => {
  describe('extractVD52TotalEkuitasFromData', () => {
    it('should extract TOTAL EKUITAS from VD52 data', () => {
      const mockVD52Data = [
        { KODE: 'A', URAIAN: 'Modal Saham', JUMLAH: 50000 },
        { KODE: 'B', URAIAN: 'TOTAL EKUITAS', JUMLAH: 250000 },
        { KODE: 'C', URAIAN: 'Liabilitas', JUMLAH: 100000 },
      ];
      const headers = ['KODE', 'URAIAN', 'JUMLAH'];

      const result = extractVD52TotalEkuitasFromData(mockVD52Data, headers);

      expect(result).toBe(250000);
    });

    it('should return 0 if TOTAL EKUITAS is not found', () => {
      const mockVD52Data = [
        { KODE: 'A', URAIAN: 'Modal Saham', JUMLAH: 50000 },
        { KODE: 'B', URAIAN: 'Some Other Row', JUMLAH: 250000 },
      ];
      const headers = ['KODE', 'URAIAN', 'JUMLAH'];

      const result = extractVD52TotalEkuitasFromData(mockVD52Data, headers);

      expect(result).toBe(0);
    });
  });

  describe('calculateVD510NilaiRanking', () => {
    it('should calculate Nilai Rangking Liabilities correctly using Total Ekuitas', () => {
      const mockVD510Data = [
        { KODE: '001', NAMA_INSTRUMEN: 'Instrumen 1', GRUP_NILAI_PASAR_WAJAR: 500000, PERSENTASE_NILAI_PASAR_WAJAR: '33.33', NILAI_RANGKING_LIABILITIES: 0 },
        { KODE: '002', NAMA_INSTRUMEN: 'Instrumen 2', GRUP_NILAI_PASAR_WAJAR: 300000, PERSENTASE_NILAI_PASAR_WAJAR: '20.00', NILAI_RANGKING_LIABILITIES: 0 },
        { KODE: 'PORT', NAMA_INSTRUMEN: 'Total Portfolio', GRUP_NILAI_PASAR_WAJAR: 0, PERSENTASE_NILAI_PASAR_WAJAR: '-', NILAI_RANGKING_LIABILITIES: 0 },
      ];
      const headers = ['KODE', 'NAMA_INSTRUMEN', 'GRUP_NILAI_PASAR_WAJAR', 'PERSENTASE_NILAI_PASAR_WAJAR', 'NILAI_RANGKING_LIABILITIES'];
      const totalEkuitas = 250000; // From VD52

      const result = calculateVD510NilaiRanking(mockVD510Data, headers, totalEkuitas);

      // Check regular rows
      expect(result[0].NILAI_RANGKING_LIABILITIES).toBe(450000); // 500000 - (20% * 250000) = 450000
      expect(result[1].NILAI_RANGKING_LIABILITIES).toBe(250000); // 300000 - (20% * 250000) = 250000

      // Check portfolio total row
      expect(result[2].NILAI_RANGKING_LIABILITIES).toBe(700000); // 450000 + 250000
      expect(result[2].NAMA_INSTRUMEN).toBe('TOTAL PORTOFOLIO MILIK (Nilai Rangking Liabilities)');
    });

    it('should set negative values to 0', () => {
      const mockVD510Data = [
        { KODE: '001', NAMA_INSTRUMEN: 'Instrumen 1', GRUP_NILAI_PASAR_WAJAR: 10000, PERSENTASE_NILAI_PASAR_WAJAR: '33.33', NILAI_RANGKING_LIABILITIES: 0 },
        { KODE: 'PORT', NAMA_INSTRUMEN: 'Total Portfolio', GRUP_NILAI_PASAR_WAJAR: 0, PERSENTASE_NILAI_PASAR_WAJAR: '-', NILAI_RANGKING_LIABILITIES: 0 },
      ];
      const headers = ['KODE', 'NAMA_INSTRUMEN', 'GRUP_NILAI_PASAR_WAJAR', 'PERSENTASE_NILAI_PASAR_WAJAR', 'NILAI_RANGKING_LIABILITIES'];
      const totalEkuitas = 250000; // From VD52

      const result = calculateVD510NilaiRanking(mockVD510Data, headers, totalEkuitas);

      // 10000 - (20% * 250000) = 10000 - 50000 = -40000 → should be 0
      expect(result[0].NILAI_RANGKING_LIABILITIES).toBe(0);
      expect(result[1].NILAI_RANGKING_LIABILITIES).toBe(0); // Portfolio total
    });

    it('should set to 0 when persentase < 20%', () => {
      const mockVD510Data = [
        { KODE: '001', NAMA_INSTRUMEN: 'Instrumen 1', GRUP_NILAI_PASAR_WAJAR: 500000, PERSENTASE_NILAI_PASAR_WAJAR: '0.15', NILAI_RANGKING_LIABILITIES: 0 },
        { KODE: 'PORT', NAMA_INSTRUMEN: 'Total Portfolio', GRUP_NILAI_PASAR_WAJAR: 0, PERSENTASE_NILAI_PASAR_WAJAR: '-', NILAI_RANGKING_LIABILITIES: 0 },
      ];
      const headers = ['KODE', 'NAMA_INSTRUMEN', 'GRUP_NILAI_PASAR_WAJAR', 'PERSENTASE_NILAI_PASAR_WAJAR', 'NILAI_RANGKING_LIABILITIES'];
      const totalEkuitas = 250000; // From VD52

      const result = calculateVD510NilaiRanking(mockVD510Data, headers, totalEkuitas);

      expect(result[0].NILAI_RANGKING_LIABILITIES).toBe(0); // Auto-zero due to persentase < 20%
      expect(result[1].NILAI_RANGKING_LIABILITIES).toBe(0); // Portfolio total
    });
  });
});
