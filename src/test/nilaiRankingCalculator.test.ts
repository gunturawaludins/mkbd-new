import { describe, it, expect } from 'vitest';
import { extractVD59TotalFromData, calculateVD510NilaiRanking } from '../lib/etl/nilaiRankingCalculator';

describe('Nilai Ranking Calculator', () => {
  describe('extractVD59TotalFromData', () => {
    it('should extract TOTAL ASET LANCAR from VD59 data', () => {
      const mockVD59Data = [
        { KODE: 'A', URAIAN: 'Liabilitas Jangka Pendek', JUMLAH: 100000 },
        { KODE: 'B', URAIAN: 'TOTAL ASET LANCAR', JUMLAH: 150000 },
        { KODE: 'C', URAIAN: 'Modal Disetor', JUMLAH: 50000 },
      ];
      const headers = ['KODE', 'URAIAN', 'JUMLAH'];

      const result = extractVD59TotalFromData(mockVD59Data, headers);

      expect(result).toBe(150000);
    });

    it('should return 0 if TOTAL ASET LANCAR is not found', () => {
      const mockVD59Data = [
        { KODE: 'A', URAIAN: 'Liabilitas Jangka Pendek', JUMLAH: 100000 },
        { KODE: 'B', URAIAN: 'Some Other Row', JUMLAH: 150000 },
      ];
      const headers = ['KODE', 'URAIAN', 'JUMLAH'];

      const result = extractVD59TotalFromData(mockVD59Data, headers);

      expect(result).toBe(0);
    });
  });

  describe('calculateVD510NilaiRanking', () => {
    it('should calculate Nilai Rangking Liabilities correctly', () => {
      const mockVD510Data = [
        { KODE: '001', NAMA_INSTRUMEN: 'Instrumen 1', GRUP_NILAI_PASAR_WAJAR: 500000, PERSENTASE_NILAI_PASAR_WAJAR: '33.33', NILAI_RANGKING_LIABILITIES: 0 },
        { KODE: '002', NAMA_INSTRUMEN: 'Instrumen 2', GRUP_NILAI_PASAR_WAJAR: 300000, PERSENTASE_NILAI_PASAR_WAJAR: '20.00', NILAI_RANGKING_LIABILITIES: 0 },
        { KODE: 'PORT', NAMA_INSTRUMEN: 'Total Portfolio', GRUP_NILAI_PASAR_WAJAR: 0, PERSENTASE_NILAI_PASAR_WAJAR: '-', NILAI_RANGKING_LIABILITIES: 0 },
      ];
      const headers = ['KODE', 'NAMA_INSTRUMEN', 'GRUP_NILAI_PASAR_WAJAR', 'PERSENTASE_NILAI_PASAR_WAJAR', 'NILAI_RANGKING_LIABILITIES'];
      const totalAsetLancar = 150000;

      const result = calculateVD510NilaiRanking(mockVD510Data, headers, totalAsetLancar);

      // Check regular rows
      expect(result[0].NILAI_RANGKING_LIABILITIES).toBe(470000); // 500000 - (20% * 150000) = 470000
      expect(result[1].NILAI_RANGKING_LIABILITIES).toBe(270000); // 300000 - (20% * 150000) = 270000

      // Check portfolio total row
      expect(result[2].NILAI_RANGKING_LIABILITIES).toBe(740000); // 470000 + 270000
      expect(result[2].NAMA_INSTRUMEN).toBe('TOTAL PORTOFOLIO MILIK (Nilai Rangking Liabilities)');
    });

    it('should set negative values to 0', () => {
      const mockVD510Data = [
        { KODE: '001', NAMA_INSTRUMEN: 'Instrumen 1', GRUP_NILAI_PASAR_WAJAR: 10000, PERSENTASE_NILAI_PASAR_WAJAR: '33.33', NILAI_RANGKING_LIABILITIES: 0 },
        { KODE: 'PORT', NAMA_INSTRUMEN: 'Total Portfolio', GRUP_NILAI_PASAR_WAJAR: 0, PERSENTASE_NILAI_PASAR_WAJAR: '-', NILAI_RANGKING_LIABILITIES: 0 },
      ];
      const headers = ['KODE', 'NAMA_INSTRUMEN', 'GRUP_NILAI_PASAR_WAJAR', 'PERSENTASE_NILAI_PASAR_WAJAR', 'NILAI_RANGKING_LIABILITIES'];
      const totalAsetLancar = 150000;

      const result = calculateVD510NilaiRanking(mockVD510Data, headers, totalAsetLancar);

      // 10000 - (20% * 150000) = 10000 - 30000 = -20000 → should be 0
      expect(result[0].NILAI_RANGKING_LIABILITIES).toBe(0);
      expect(result[1].NILAI_RANGKING_LIABILITIES).toBe(0); // Portfolio total
    });

    it('should set to 0 when persentase < 20%', () => {
      const mockVD510Data = [
        { KODE: '001', NAMA_INSTRUMEN: 'Instrumen 1', GRUP_NILAI_PASAR_WAJAR: 500000, PERSENTASE_NILAI_PASAR_WAJAR: '0.15', NILAI_RANGKING_LIABILITIES: 0 },
        { KODE: 'PORT', NAMA_INSTRUMEN: 'Total Portfolio', GRUP_NILAI_PASAR_WAJAR: 0, PERSENTASE_NILAI_PASAR_WAJAR: '-', NILAI_RANGKING_LIABILITIES: 0 },
      ];
      const headers = ['KODE', 'NAMA_INSTRUMEN', 'GRUP_NILAI_PASAR_WAJAR', 'PERSENTASE_NILAI_PASAR_WAJAR', 'NILAI_RANGKING_LIABILITIES'];
      const totalAsetLancar = 150000;

      const result = calculateVD510NilaiRanking(mockVD510Data, headers, totalAsetLancar);

      expect(result[0].NILAI_RANGKING_LIABILITIES).toBe(0); // Auto-zero due to persentase < 20%
      expect(result[1].NILAI_RANGKING_LIABILITIES).toBe(0); // Portfolio total
    });
  });
});
