# TODO: Update Nilai Rangking Liabilities Logic

## Tasks
- [ ] Update `crossTableCalculations.ts` to extract "TOTAL ASET LANCAR" instead of "TOTAL MODAL KERJA BERSIH"
- [ ] Update `testDataGenerator.ts` to use "TOTAL ASET LANCAR" in the test data
- [ ] In `nilaiRankingCalculator.ts`, add logic to set the description column for the portfolio row to "TOTAL PORTOFOLIO MILIK (Nilai Rangking Liabilities)"
- [ ] Add 'total portofolio milik' to the portfolio total markers
- [ ] Test the changes with the updated test data
- [ ] Run the extractor to verify the calculations
