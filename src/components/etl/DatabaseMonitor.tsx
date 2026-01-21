import React, { useState, useEffect } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Database, 
  RefreshCw, 
  Trash2, 
  Eye, 
  ChevronDown,
  ChevronUp,
  Download,
  AlertCircle,
  Table as TableIcon,
  Clock
} from 'lucide-react';
import { 
  getAllTables, 
  getTableData, 
  clearTable, 
  getTableStats
} from '@/lib/etl/database';
import { DatabaseRecord } from '@/lib/etl/types';
import { toast } from 'sonner';

interface TableMeta {
  tableName: string;
  headers: string[];
  recordCount: number;
  lastUpdated: string;
  createdAt: string;
}

export function DatabaseMonitor() {
  const [tables, setTables] = useState<TableMeta[]>([]);
  const [stats, setStats] = useState({ totalTables: 0, totalRecords: 0 });
  const [expandedTable, setExpandedTable] = useState<string | null>(null);
  const [tableData, setTableData] = useState<DatabaseRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadTables = async () => {
    setIsLoading(true);
    try {
      const tablesData = await getAllTables();
      setTables(tablesData);
      const statsData = await getTableStats();
      setStats(statsData);
    } catch (error) {
      console.error('Failed to load tables:', error);
      toast.error('Gagal memuat data tabel');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTables();
  }, []);

  const handleViewTable = async (tableName: string) => {
    if (expandedTable === tableName) {
      setExpandedTable(null);
      setTableData([]);
      return;
    }

    try {
      const data = await getTableData(tableName);
      setTableData(data);
      setExpandedTable(tableName);
    } catch (error) {
      console.error('Failed to load table data:', error);
      toast.error('Gagal memuat data tabel');
    }
  };

  const handleClearTable = async (tableName: string) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus semua data di tabel "${tableName}"?`)) {
      return;
    }

    try {
      await clearTable(tableName);
      toast.success(`Tabel "${tableName}" berhasil dikosongkan`);
      await loadTables();
      if (expandedTable === tableName) {
        setExpandedTable(null);
        setTableData([]);
      }
    } catch (error) {
      console.error('Failed to clear table:', error);
      toast.error('Gagal mengosongkan tabel');
    }
  };

  const handleExportTable = async (tableName: string) => {
    try {
      const data = await getTableData(tableName);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${tableName}_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Data berhasil diekspor');
    } catch (error) {
      console.error('Failed to export table:', error);
      toast.error('Gagal mengekspor data');
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('id-ID', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  };

  const formatCellValue = (value: unknown): string => {
    if (value === null || value === undefined) return '-';
    if (typeof value === 'number') {
      return value.toLocaleString('id-ID', { maximumFractionDigits: 2 });
    }
    return String(value);
  };

  const formatHeaderName = (header: string): string => {
    let result = header;
    
    // Jika sudah ada underscore, gunakan itu sebagai delimiter
    if (result.includes('_')) {
      result = result
        .replace(/_/g, ' ')
        .replace(/\b\w/g, str => str.toUpperCase());
      return result.trim();
    }
    
    // Jika camelCase (ada mix of upper dan lowercase)
    if (/[a-z]/.test(result) && /[A-Z]/.test(result)) {
      result = result
        .replace(/([A-Z])/g, ' $1')
        .replace(/\b\w/g, str => str.toUpperCase())
        .trim();
      return result.trim();
    }
    
    // Jika ALL_CAPS - gunakan special case mapping
    if (/^[A-Z]+$/.test(result) && result.length > 3) {
      const upper = result.toUpperCase();
      
      // Special cases - exact phrases yang perlu di-split
      const specialCases: Record<string, string> = {
        'NAMAEEMITENMASTER': 'Nama Emiten Master',
        'KATEGORIEEMITEN': 'Kategori Emiten',
        'NILAIPASAR': 'Nilai Pasar',
        'GRUPNILAIPASAR': 'Grup Nilai Pasar',
        'GRUPENEMITEN': 'Grup Emiten',
        'JARAKWILAYAH': 'Jarak Wilayah',
        'TOTALMODALSENDIRI': 'Total Modal Sendiri',
        'KODEEFEK': 'Kode Efek',
        'STATUSDATA': 'Status Data',
        'PASAR': 'Pasar',
        'WAJAR': 'Wajar',
      };
      
      if (specialCases[upper]) {
        return specialCases[upper];
      }
    }
    
    // Default: Title case
    return result
      .split(/\s+/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  const getHeaderColor = (header: string): string => {
    const lowerHeader = header.toLowerCase();
    
    // Total/Summary columns - green
    if (lowerHeader.includes('total') || lowerHeader.includes('jumlah') || lowerHeader.includes('sum')) {
      return 'bg-emerald-50 text-emerald-900';
    }
    
    // Amount/Value columns - blue
    if (lowerHeader.includes('nilai') || lowerHeader.includes('amount') || lowerHeader.includes('price') || 
        lowerHeader.includes('harga') || lowerHeader.includes('pasarwilayah') || lowerHeader.includes('pasarw')) {
      return 'bg-blue-50 text-blue-900';
    }
    
    // ID/Code columns - slate
    if (lowerHeader.includes('kode') || lowerHeader.includes('code') || lowerHeader.includes('id') || 
        lowerHeader.includes('nomor') || lowerHeader.includes('no')) {
      return 'bg-slate-50 text-slate-900';
    }
    
    // Date/Time columns - orange
    if (lowerHeader.includes('tanggal') || lowerHeader.includes('date') || lowerHeader.includes('waktu') || 
        lowerHeader.includes('time')) {
      return 'bg-orange-50 text-orange-900';
    }
    
    // Category/Name columns - purple
    if (lowerHeader.includes('nama') || lowerHeader.includes('name') || lowerHeader.includes('kategori') || 
        lowerHeader.includes('category') || lowerHeader.includes('grup') || lowerHeader.includes('group')) {
      return 'bg-purple-50 text-purple-900';
    }
    
    // Default - gray
    return 'bg-gray-50 text-gray-900';
  };

  const getRowHighlightClass = (row: Record<string, unknown>): string => {
    const rowText = Object.values(row)
      .map(v => String(v).toLowerCase())
      .join(' ');
    
    // Highlight rows yang mengandung total/summary
    if (rowText.includes('total') || rowText.includes('jumlah') || rowText.includes('grand total')) {
      return 'bg-emerald-50/60 hover:bg-emerald-100/60 font-semibold border-l-4 border-emerald-500';
    }
    
    return 'hover:bg-primary/5 transition-colors border-l-4 border-transparent';
  };

  if (tables.length === 0 && !isLoading) {
    return (
      <Card className="border-dashed border-2">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <div className="bg-muted/50 p-4 rounded-full mb-4">
            <Database className="w-12 h-12 text-muted-foreground" />
          </div>
          <h3 className="font-semibold text-lg mb-2">Database Kosong</h3>
          <p className="text-muted-foreground text-sm max-w-md">
            Belum ada data yang disimpan. Unggah file Excel dan klik "Simpan ke Database" untuk memulai.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Header */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-background">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 p-2.5 rounded-lg">
                  <TableIcon className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Total Tabel</p>
                  <p className="text-2xl font-bold">{stats.totalTables}</p>
                </div>
              </div>
              <div className="w-px h-12 bg-border"></div>
              <div className="flex items-center gap-3">
                <div className="bg-green-500/10 p-2.5 rounded-lg">
                  <Database className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Total Record</p>
                  <p className="text-2xl font-bold">{stats.totalRecords.toLocaleString()}</p>
                </div>
              </div>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={loadTables} 
              disabled={isLoading}
              className="gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              Segarkan
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Tables List */}
      <div className="space-y-4">
        {tables.map((table) => (
          <Card key={table.tableName} className="overflow-hidden border-primary/10 hover:border-primary/30 transition-colors">
            <CardHeader className="py-4 border-b border-border/50 bg-muted/30">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="bg-primary/10 p-2 rounded-lg flex-shrink-0">
                    <TableIcon className="w-4 h-4 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <CardTitle className="text-base font-semibold truncate">{table.tableName}</CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">
                      {table.headers.length} kolom
                    </p>
                  </div>
                  <Badge variant="default" className="flex-shrink-0 font-semibold px-3">
                    {table.recordCount} records
                  </Badge>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleViewTable(table.tableName)}
                    className="gap-2"
                    title={expandedTable === table.tableName ? "Sembunyikan" : "Lihat Detail"}
                  >
                    {expandedTable === table.tableName ? (
                      <>
                        <ChevronUp className="w-4 h-4" />
                        <span className="text-xs">Sembunyikan</span>
                      </>
                    ) : (
                      <>
                        <Eye className="w-4 h-4" />
                        <span className="text-xs">Lihat</span>
                      </>
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleExportTable(table.tableName)}
                    className="gap-2"
                    title="Ekspor sebagai JSON"
                  >
                    <Download className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => handleClearTable(table.tableName)}
                    title="Hapus semua data"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-3 pt-3 border-t border-border/50">
                <Clock className="w-3.5 h-3.5" />
                <span>Diperbarui: {formatDate(table.lastUpdated)}</span>
              </div>
            </CardHeader>

            {expandedTable === table.tableName && tableData.length > 0 && (
              <CardContent className="pt-4">
                <div className="rounded-lg border border-border/50 overflow-hidden">
                  <ScrollArea className="h-[400px]">
                    <div className="min-w-max">
                      <Table>
                        <TableHeader className="sticky top-0 bg-gradient-to-b from-primary/10 to-primary/5 backdrop-blur-sm z-10 border-b-2 border-primary/20">
                          <TableRow className="hover:bg-transparent">
                            <TableHead className="w-12 text-center font-bold text-primary sticky left-0 bg-gradient-to-b from-primary/10 to-primary/5">
                              No.
                            </TableHead>
                            {Object.keys(tableData[0])
                              .filter((k) => k !== 'id')
                              .map((key) => (
                                <TableHead 
                                  key={key} 
                                  className={`whitespace-nowrap min-w-[130px] font-semibold px-3 py-2 ${getHeaderColor(key)}`}
                                >
                                  {formatHeaderName(key)}
                                </TableHead>
                              ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {tableData.slice(0, 50).map((row, idx) => (
                            <TableRow 
                              key={idx}
                              className={getRowHighlightClass(row)}
                            >
                              <TableCell className="text-center text-muted-foreground font-mono text-xs font-medium sticky left-0 bg-muted/30">
                                {idx + 1}
                              </TableCell>
                              {Object.entries(row)
                                .filter(([k]) => k !== 'id')
                                .map(([key, value], colIdx) => (
                                  <TableCell
                                    key={colIdx}
                                    className="whitespace-nowrap max-w-[250px] truncate text-sm py-3"
                                    title={formatCellValue(value)}
                                  >
                                    {formatCellValue(value)}
                                  </TableCell>
                                ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    <ScrollBar orientation="horizontal" />
                  </ScrollArea>
                </div>
                {tableData.length > 50 && (
                  <div className="flex items-center justify-center mt-4 pt-3 border-t border-border/50">
                    <p className="text-sm text-muted-foreground">
                      Menampilkan <span className="font-medium text-foreground">50</span> dari <span className="font-medium text-foreground">{tableData.length}</span> records
                    </p>
                  </div>
                )}
              </CardContent>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
