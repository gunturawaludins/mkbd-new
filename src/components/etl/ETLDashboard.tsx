import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  Upload, 
  Database, 
  CheckCircle, 
  AlertCircle, 
  FileSpreadsheet,
  Save,
  Loader2,
  Info,
  Users,
  TrendingUp,
  Zap
} from 'lucide-react';
import { FileUpload } from './FileUpload';
import { DataPreview } from './DataPreview';
import { DatabaseMonitor } from './DatabaseMonitor';
import { MasterDataUpload } from './MasterDataUpload';
import { FormulaEditor } from './FormulaEditor';
import { extractFromExcel, ProcessedSheet, ETLResult } from '@/lib/etl';
import { createTableIfNotExists, appendRecords } from '@/lib/etl/database';
import { DatabaseRecord } from '@/lib/etl/types';
import { createTestVD59VD510File, logExpectedCalculations } from '@/lib/etl/testDataGenerator';
import { evaluateFormulaForRows, testFormula } from '@/lib/etl/formulaEvaluator';
import { toast } from 'sonner';

export function ETLDashboard() {
  const [activeTab, setActiveTab] = useState('upload');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [etlResult, setEtlResult] = useState<ETLResult | null>(null);
  const [selectedSheetIndex, setSelectedSheetIndex] = useState(0);
  const [fileName, setFileName] = useState<string>('');
  const [masterDataVersion, setMasterDataVersion] = useState(0);
  const [showFormulaEditor, setShowFormulaEditor] = useState(false);

  const handleFileSelect = async (file: File) => {
    setIsProcessing(true);
    setEtlResult(null);
    setFileName(file.name);

    try {
      const result = await extractFromExcel(file);
      setEtlResult(result);
      setSelectedSheetIndex(0);
      
      if (result.success && result.sheets.length > 0) {
        toast.success(`${result.sheets.length} sheet berhasil diproses`);
      } else if (!result.success) {
        toast.error('Gagal memproses file');
      }
    } catch (error) {
      console.error('ETL Error:', error);
      toast.error('Terjadi kesalahan saat memproses file');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleLoadTestData = async () => {
    console.log('Loading test data for VD59 and VD510...');
    logExpectedCalculations();
    
    const testBlob = createTestVD59VD510File();
    const testFile = new File([testBlob], 'test-vd59-vd510.xlsx', { type: testBlob.type });
    
    await handleFileSelect(testFile);
  };

  const handleFormulaApply = (formula: string, targetColumn: string) => {
    if (!etlResult?.sheets[selectedSheetIndex]) return;

    const sheet = etlResult.sheets[selectedSheetIndex];
    
    // Test formula dengan sample data
    const testSample = sheet.data[0] || {};
    const testResult = testFormula(formula, testSample);

    if (!testResult.success) {
      toast.error(`Error pada formula: ${testResult.error}`);
      return;
    }

    // Evaluate formula untuk semua rows
    const result = evaluateFormulaForRows(formula, sheet.data, targetColumn);

    if (result.errorCount > 0) {
      console.warn(`Formula applied dengan ${result.errorCount} error:`);
      result.errors.slice(0, 5).forEach(e => {
        console.warn(`  Row ${e.rowIndex}: ${e.error}`);
      });
    }

    // Update the sheet with calculated data
    const updatedSheets = [...etlResult.sheets];
    updatedSheets[selectedSheetIndex] = {
      ...sheet,
      data: result.updatedRows,
    };

    setEtlResult({
      ...etlResult,
      sheets: updatedSheets,
    });

    toast.success(
      `Formula berhasil diterapkan! ${result.successCount} row berhasil, ${result.errorCount} error`
    );
    setShowFormulaEditor(false);
  };

  const handleSaveToDatabase = async () => {
    if (!etlResult?.sheets.length) return;

    setIsSaving(true);
    let savedCount = 0;
    let totalRecords = 0;

    try {
      // Step 1: Save all data to database
      for (const sheet of etlResult.sheets) {
        // Create table if not exists
        await createTableIfNotExists(sheet.tableName, sheet.headers);
        
        // Append records
        const count = await appendRecords(sheet.tableName, sheet.data as DatabaseRecord[]);
        savedCount++;
        totalRecords += count;
      }

      console.log(`✅ Saved ${totalRecords} records to ${savedCount} tables`);
      console.log('Note: Nilai Rangking Liabilities calculated during extraction');
      toast.success(
        `Berhasil menyimpan ${totalRecords.toLocaleString()} record ke ${savedCount} tabel`
      );
      
      // Switch to monitor tab
      setActiveTab('monitor');
    } catch (error) {
      console.error('Save Error:', error);
      toast.error('Gagal menyimpan data ke database');
    } finally {
      setIsSaving(false);
    }
  };

  const currentSheet = etlResult?.sheets[selectedSheetIndex];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <FileSpreadsheet className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">
                  ETL Laporan MKBD
                </h1>
                <p className="text-sm text-muted-foreground">
                  Extract, Transform, Load untuk Laporan Keuangan
                </p>
              </div>
            </div>
            {fileName && (
              <Badge variant="outline" className="font-mono">
                {fileName}
              </Badge>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="upload" className="flex items-center gap-2">
              <Upload className="w-4 h-4" />
              Upload & Preview
            </TabsTrigger>
            <TabsTrigger value="monitor" className="flex items-center gap-2">
              <Database className="w-4 h-4" />
              Database Monitor
            </TabsTrigger>
          </TabsList>

          {/* Upload Tab */}
          <TabsContent value="upload" className="space-y-6">
            {/* Master Data Section */}
            <MasterDataUpload 
              onMasterDataLoaded={() => setMasterDataVersion(v => v + 1)} 
            />

            <Card className="border-primary/20 bg-gradient-to-br from-background via-background to-primary/5">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="bg-primary/10 p-2 rounded-lg">
                    <Upload className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      Upload File Laporan MKBD
                    </CardTitle>
                    <CardDescription className="mt-2">
                      Unggah file Excel laporan MKBD. Sistem akan otomatis:
                      <ul className="list-disc list-inside mt-2 space-y-1">
                        <li>Memindai semua sheet dan membersihkan data</li>
                        <li>Mencocokkan Kode Efek dengan Master Data (VLOOKUP)</li>
                        <li>Menghitung GRUP NILAI PASAR WAJAR (Agregasi)</li>
                      </ul>
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <FileUpload onFileSelect={handleFileSelect} isLoading={isProcessing} />
                <div className="mt-4 flex gap-2 justify-center">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={handleLoadTestData}
                    disabled={isProcessing}
                  >
                    Load Test Data (VD59+VD510)
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Processing Info */}
            {etlResult && (
              <>
                {/* Status Alert */}
                <Alert variant={etlResult.success ? 'default' : 'destructive'}>
                  {etlResult.success ? (
                    <CheckCircle className="w-4 h-4" />
                  ) : (
                    <AlertCircle className="w-4 h-4" />
                  )}
                  <AlertTitle>
                    {etlResult.success ? 'Berhasil Diproses' : 'Proses Gagal'}
                  </AlertTitle>
                  <AlertDescription>
                    {etlResult.success
                      ? `${etlResult.sheets.length} sheet siap untuk disimpan ke database.`
                      : etlResult.errors.join(', ')}
                  </AlertDescription>
                </Alert>

                {/* Warnings */}
                {etlResult.warnings.length > 0 && (
                  <Alert>
                    <Info className="w-4 h-4" />
                    <AlertTitle>Informasi</AlertTitle>
                    <AlertDescription>
                      <ul className="list-disc list-inside space-y-1 mt-2">
                        {etlResult.warnings.slice(0, 5).map((warning, idx) => (
                          <li key={idx} className="text-sm">{warning}</li>
                        ))}
                        {etlResult.warnings.length > 5 && (
                          <li className="text-sm text-muted-foreground">
                            ...dan {etlResult.warnings.length - 5} peringatan lainnya
                          </li>
                        )}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}

                {/* Enrichment Stats */}
                {currentSheet?.metadata.enrichmentStats && (
                  <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-blue-50/50">
                    <CardHeader className="pb-3 border-b border-blue-200">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-blue-600" />
                        <CardTitle className="text-base text-blue-900">Statistik Enrichment & Agregasi</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="p-3 bg-white rounded-lg border-2 border-emerald-200 shadow-sm">
                          <div className="text-xs text-muted-foreground font-semibold mb-1 uppercase">Matched</div>
                          <div className="text-2xl font-bold text-emerald-700">
                            {currentSheet.metadata.enrichmentStats.matchedCount}
                          </div>
                        </div>
                        <div className="p-3 bg-white rounded-lg border-2 border-orange-200 shadow-sm">
                          <div className="text-xs text-muted-foreground font-semibold mb-1 uppercase">Non-Grup</div>
                          <div className="text-2xl font-bold text-orange-600">
                            {currentSheet.metadata.enrichmentStats.unmatchedCount}
                          </div>
                        </div>
                        <div className="p-3 bg-white rounded-lg border-2 border-blue-200 shadow-sm">
                          <div className="text-xs text-muted-foreground font-semibold mb-1 uppercase">Grup Unik</div>
                          <div className="text-2xl font-bold text-blue-700">
                            {currentSheet.metadata.enrichmentStats.groupCount}
                          </div>
                        </div>
                        <div className="p-3 bg-white rounded-lg border-2 border-purple-200 shadow-sm">
                          <div className="text-xs text-muted-foreground font-semibold mb-1 uppercase">Total Nilai</div>
                          <div className="text-2xl font-bold text-purple-700">
                            {(currentSheet.metadata.enrichmentStats.totalGroupValue / 1e9).toFixed(2)}B
                          </div>
                        </div>
                      </div>
                      {currentSheet.metadata.enrichmentStats.kodeEfekColumn && (
                        <p className="text-xs text-blue-700 mt-4 pt-3 border-t border-blue-200">
                          <span className="font-semibold">Kolom Kode:</span> <Badge variant="outline" className="ml-1 bg-blue-100 border-blue-300 text-blue-800">{currentSheet.metadata.enrichmentStats.kodeEfekColumn}</Badge>
                          {currentSheet.metadata.enrichmentStats.nilaiPasarColumn && (
                            <> • <span className="font-semibold ml-2">Kolom Nilai:</span> <Badge variant="outline" className="ml-1 bg-blue-100 border-blue-300 text-blue-800">{currentSheet.metadata.enrichmentStats.nilaiPasarColumn}</Badge></>
                          )}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Sheet Tabs */}
                {etlResult.sheets.length > 0 && (
                  <Card className="border-primary/10 bg-gradient-to-br from-background via-background to-primary/5">
                    <CardHeader className="pb-3 border-b border-primary/10">
                      <div className="flex items-center justify-between flex-wrap gap-4">
                        <div className="flex items-center gap-3">
                          <div className="bg-primary/10 p-2 rounded-lg">
                            <FileSpreadsheet className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <CardTitle>Preview Data Bersih</CardTitle>
                            <CardDescription className="mt-1">
                              Pratinjau data setelah proses cleaning dan enrichment
                            </CardDescription>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button 
                            onClick={() => setShowFormulaEditor(true)}
                            variant="outline"
                            className="gap-2"
                          >
                            <Zap className="w-4 h-4" />
                            Formula Editor
                          </Button>
                          <Button 
                            onClick={handleSaveToDatabase}
                            disabled={isSaving}
                            className="gap-2 bg-emerald-600 hover:bg-emerald-700"
                          >
                            {isSaving ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Save className="w-4 h-4" />
                            )}
                            Simpan ke Database
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-4">
                      {/* Sheet Selector */}
                      {etlResult.sheets.length > 1 && (
                        <div className="flex flex-wrap gap-2 pb-4 border-b border-border/50">
                          {etlResult.sheets.map((sheet, idx) => (
                            <Button
                              key={idx}
                              variant={selectedSheetIndex === idx ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => setSelectedSheetIndex(idx)}
                              className="gap-2"
                            >
                              {sheet.sheetName}
                              <Badge 
                                variant={selectedSheetIndex === idx ? 'secondary' : 'outline'}
                              >
                                {sheet.data.length}
                              </Badge>
                            </Button>
                          ))}
                        </div>
                      )}

                      {/* Data Preview */}
                      {currentSheet && <DataPreview sheet={currentSheet} />}
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </TabsContent>

          {/* Database Monitor Tab */}
          <TabsContent value="monitor">
            <Card className="border-primary/20 bg-gradient-to-br from-background via-background to-primary/5">
              <CardHeader className="pb-3 border-b border-primary/10">
                <div className="flex items-center gap-3">
                  <div className="bg-primary/10 p-2 rounded-lg">
                    <Database className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Database Monitor</CardTitle>
                    <CardDescription className="mt-1">
                      Lihat dan kelola data yang tersimpan di database lokal (IndexedDB).
                      Data bersifat append (ditambahkan), tidak menimpa data lama.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <DatabaseMonitor />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* Formula Editor Modal */}
      {showFormulaEditor && etlResult?.sheets[selectedSheetIndex] && (
        <FormulaEditor
          columns={etlResult.sheets[selectedSheetIndex].headers}
          allSheetColumns={etlResult.sheets
            .map((sheet, idx) => 
              idx !== selectedSheetIndex 
                ? { sheetName: sheet.tableName, headers: sheet.headers }
                : null
            )
            .filter(Boolean) as Array<{ sheetName: string; headers: string[] }>
          }
          onSave={handleFormulaApply}
          onCancel={() => setShowFormulaEditor(false)}
        />
      )}

      {/* Footer */}
      <footer className="border-t mt-8">
        <div className="container mx-auto px-4 py-4">
          <p className="text-center text-sm text-muted-foreground">
            Sistem ETL Laporan MKBD • Data disimpan secara lokal di browser Anda
          </p>
        </div>
      </footer>
    </div>
  );
}
