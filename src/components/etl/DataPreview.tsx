import React, { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calculator, Eye, EyeOff } from 'lucide-react';
import { ProcessedSheet } from '@/lib/etl/types';

interface DataPreviewProps {
  sheet: ProcessedSheet;
  maxRows?: number;
}

export function DataPreview({ sheet, maxRows = 100 }: DataPreviewProps) {
  const [showFormulas, setShowFormulas] = useState(false);
  
  // Define columns to hide for VD59 sheet
  const vd59HiddenColumns = [
    'GRUP_EMITEN',
    'NAMA_EMITEN_MASTER',
    'KATEGORI_EMITEN',
    'NILAI_PASAR_WAJAR_CLEAN',
    'GRUP_NILAI_PASAR_WAJAR',
    'File_Name',
    'Upload_Date',
  ];
  
  // Filter headers based on sheet type
  const isVD59 = sheet.tableName.toLowerCase().includes('vd59');
  const filteredHeaders = isVD59 
    ? sheet.headers.filter(header => !vd59HiddenColumns.includes(header))
    : sheet.headers;
  
  const displayData = sheet.data.slice(0, maxRows);
  const displayHeaders = filteredHeaders;
  
  const formatCellValue = (value: unknown): string => {
    if (value === null || value === undefined) return '-';
    if (typeof value === 'number') {
      // Format numbers with thousand separators
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

  const getCellStyle = (value: unknown, sheetName: string): string => {
    const isEmpty = value === null || value === undefined || value === '' || value === '-';

    // For VD59 sheets, make empty cells much darker and blocked appearance
    if (isEmpty && sheetName.toLowerCase().includes('vd59')) {
      return 'bg-slate-400 text-slate-600 italic font-medium shadow-inner cursor-not-allowed opacity-75';
    }

    // For other sheets, make empty cells slightly darker
    if (isEmpty) {
      return 'bg-gray-100 text-gray-500 italic';
    }

    return '';
  };

  const getCalculationSource = (row: Record<string, unknown>, headers: string[]): string => {
    // Check if this is a calculated column (Nilai Rangking Liabilities)
    const nilaiRankingColumn = headers.find(h =>
      h.toLowerCase().includes('nilai_rangking_liabilities') ||
      h.toLowerCase().includes('nilai ranking liabilities')
    );

    if (nilaiRankingColumn && row[nilaiRankingColumn] !== null && row[nilaiRankingColumn] !== undefined) {
      // This is a calculated value - show the formula
      const grupColumn = headers.find(h =>
        h.toLowerCase().includes('grup_nilai_pasar') ||
        h.toLowerCase().includes('grup nilai pasar')
      );

      if (grupColumn && row[grupColumn]) {
        const grupValue = parseFloat(String(row[grupColumn])) || 0;
        const calculatedValue = parseFloat(String(row[nilaiRankingColumn])) || 0;

        // Show the formula: GRUP - (20% × TOTAL_ASET_LANCAR)
        return `📊 ${grupValue.toLocaleString('id-ID')} - (20% × TOTAL_ASET_LANCAR) = ${calculatedValue.toLocaleString('id-ID')}`;
      }
    }

    // For other columns, show that it's from Excel data
    return '📄 Data dari Excel';
  };

  return (
    <Card className="w-full border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <CardTitle className="text-lg">{sheet.sheetName}</CardTitle>
            <Badge variant="secondary" className="font-mono text-xs px-2 py-1">
              {sheet.tableName}
            </Badge>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <span className="font-medium">{sheet.metadata.cleanedRowCount}</span>
              <span>baris</span>
            </div>
            <div className="w-px h-4 bg-border"></div>
            <div className="flex items-center gap-1">
              <span className="font-medium">{displayHeaders.length}</span>
              <span>kolom</span>
            </div>
            {sheet.metadata.originalRowCount !== sheet.metadata.cleanedRowCount && (
              <>
                <div className="w-px h-4 bg-border"></div>
                <div className="flex items-center gap-1 text-amber-600 font-medium">
                  <span>{sheet.metadata.originalRowCount - sheet.metadata.cleanedRowCount}</span>
                  <span>dihapus</span>
                </div>
              </>
            )}
            <div className="w-px h-4 bg-border"></div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFormulas(!showFormulas)}
              className="flex items-center gap-2"
            >
              {showFormulas ? <EyeOff size={14} /> : <Calculator size={14} />}
              {showFormulas ? 'Sembunyikan Rumus' : 'Tampilkan Rumus'}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <ScrollArea className="h-[450px] rounded-lg border border-border bg-background/50">
          <div className="min-w-max">
            <Table>
              <TableHeader className="sticky top-0 bg-gradient-to-b from-primary/10 to-primary/5 backdrop-blur-sm z-10 border-b-2 border-primary/20">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-12 text-center font-bold text-primary sticky left-0 bg-gradient-to-b from-primary/10 to-primary/5">
                    No.
                  </TableHead>
                  {displayHeaders.map((header, idx) => (
                    <TableHead
                      key={idx}
                      className={`whitespace-nowrap font-semibold min-w-[140px] px-3 py-2 ${getHeaderColor(header)}`}
                    >
                      {formatHeaderName(header)}
                    </TableHead>
                  ))}
                  {showFormulas && (
                    <TableHead className="whitespace-nowrap font-semibold min-w-[200px] px-3 py-2 bg-amber-50 text-amber-900">
                      Sumber Perhitungan
                    </TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayData.map((row, rowIdx) => (
                  <TableRow 
                    key={rowIdx} 
                    className={getRowHighlightClass(row)}
                  >
                    <TableCell className="text-center text-muted-foreground font-mono text-xs font-medium sticky left-0 bg-muted/30">
                      {rowIdx + 1}
                    </TableCell>
                    {displayHeaders.map((header, colIdx) => (
                      <TableCell
                        key={colIdx}
                        className={`whitespace-nowrap max-w-[300px] truncate text-sm py-3 ${getCellStyle(row[header], sheet.sheetName)}`}
                        title={formatCellValue(row[header])}
                      >
                        {formatCellValue(row[header])}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>

        {sheet.data.length > maxRows && (
          <div className="flex items-center justify-center mt-4 pt-3 border-t border-border/50">
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{maxRows}</span> dari <span className="font-medium text-foreground">{sheet.data.length}</span> baris ditampilkan
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
