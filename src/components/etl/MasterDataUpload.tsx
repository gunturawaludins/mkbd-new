import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  Upload, 
  FileSpreadsheet, 
  CheckCircle, 
  AlertCircle,
  Database,
  RefreshCw,
  Loader2
} from 'lucide-react';
import { 
  loadMasterDataFromFile, 
  loadMasterDataFromPublic, 
  isMasterLoaded,
  getMasterDataStats,
  clearMasterData
} from '@/lib/etl/masterData';
import { toast } from 'sonner';

interface MasterDataUploadProps {
  onMasterDataLoaded?: () => void;
}

export function MasterDataUpload({ onMasterDataLoaded }: MasterDataUploadProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [stats, setStats] = useState<{
    totalEmiten: number;
    uniqueGroups: number;
    categories: Record<string, number>;
  } | null>(null);
  const [loadSource, setLoadSource] = useState<'default' | 'custom' | null>(null);

  // Try to load default master data on mount
  useEffect(() => {
    if (!isMasterLoaded()) {
      loadDefaultMasterData();
    } else {
      setIsLoaded(true);
      setStats(getMasterDataStats());
      setLoadSource('default');
    }
  }, []);

  const loadDefaultMasterData = async () => {
    setIsLoading(true);
    try {
      const result = await loadMasterDataFromPublic();
      if (result.success) {
        setIsLoaded(true);
        setStats(getMasterDataStats());
        setLoadSource('default');
        onMasterDataLoaded?.();
      }
    } catch (error) {
      console.warn('Could not load default master data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    try {
      const result = await loadMasterDataFromFile(file);
      
      if (result.success) {
        setIsLoaded(true);
        setStats(getMasterDataStats());
        setLoadSource('custom');
        toast.success(`Master data berhasil dimuat: ${result.count} emiten`);
        onMasterDataLoaded?.();
      } else {
        toast.error(result.errors.join(', '));
      }
    } catch (error) {
      toast.error('Gagal memuat master data');
    } finally {
      setIsLoading(false);
      // Reset input
      event.target.value = '';
    }
  };

  const handleReset = () => {
    clearMasterData();
    setIsLoaded(false);
    setStats(null);
    setLoadSource(null);
    loadDefaultMasterData();
  };

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-background via-background to-primary/5">
      <CardHeader className="pb-3 border-b border-primary/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 p-2 rounded-lg">
              <Database className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Master Data Emiten</CardTitle>
              <CardDescription className="mt-1">
                Data referensi untuk pencocokan Kode Efek
              </CardDescription>
            </div>
          </div>
          {isLoaded && (
            <Badge variant="outline" className="gap-1 border-emerald-200 bg-emerald-50 text-emerald-700">
              <CheckCircle className="w-3 h-3" />
              {loadSource === 'default' ? 'Default' : 'Custom'}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">Memuat master data...</span>
          </div>
        ) : isLoaded && stats ? (
          <>
            <Alert className="border-emerald-200 bg-emerald-50">
              <CheckCircle className="w-4 h-4 text-emerald-600" />
              <AlertTitle className="text-emerald-900">Master Data Aktif</AlertTitle>
              <AlertDescription className="mt-3 text-emerald-800">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="bg-white rounded p-3 border border-emerald-100">
                    <span className="text-muted-foreground block text-xs font-medium mb-1">Total Emiten</span>
                    <span className="text-lg font-bold text-emerald-700">{stats.totalEmiten.toLocaleString()}</span>
                  </div>
                  <div className="bg-white rounded p-3 border border-emerald-100">
                    <span className="text-muted-foreground block text-xs font-medium mb-1">Grup Unik</span>
                    <span className="text-lg font-bold text-emerald-700">{stats.uniqueGroups}</span>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="text-xs font-semibold text-emerald-900 block w-full">Kategori:</span>
                  {Object.entries(stats.categories).slice(0, 8).map(([cat, count]) => (
                    <Badge key={cat} variant="secondary" className="text-xs bg-emerald-100 text-emerald-800 border-emerald-200">
                      {cat}: {count}
                    </Badge>
                  ))}
                </div>
              </AlertDescription>
            </Alert>
            
            <div className="flex gap-2">
              <label className="flex-1">
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <Button variant="outline" className="w-full gap-2" asChild>
                  <span>
                    <Upload className="w-4 h-4" />
                    Ganti Master Data
                  </span>
                </Button>
              </label>
              <Button variant="ghost" size="icon" onClick={handleReset} title="Reset ke default">
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </>
        ) : (
          <>
            <Alert variant="destructive" className="border-red-200 bg-red-50">
              <AlertCircle className="w-4 h-4 text-red-600" />
              <AlertTitle className="text-red-900">Master Data Tidak Tersedia</AlertTitle>
              <AlertDescription className="text-red-800">
                Upload file master data emiten untuk mengaktifkan fitur grouping dan agregasi.
              </AlertDescription>
            </Alert>
            
            <label>
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileUpload}
                className="hidden"
              />
              <Button className="w-full gap-2" asChild>
                <span>
                  <FileSpreadsheet className="w-4 h-4" />
                  Upload Master Data
                </span>
              </Button>
            </label>
          </>
        )}
      </CardContent>
    </Card>
  );
}
