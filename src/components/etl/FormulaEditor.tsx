import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { X, Plus } from 'lucide-react';

interface FormulaEditorProps {
  columns: string[];
  allSheetColumns?: Array<{ sheetName: string; headers: string[] }>;
  onSave: (formula: string, targetColumn: string) => void;
  onCancel: () => void;
}

interface FormulaToken {
  type: 'column' | 'operator' | 'number' | 'function' | 'bracket';
  value: string;
}

export function FormulaEditor({ columns, allSheetColumns, onSave, onCancel }: FormulaEditorProps) {
  const [formula, setFormula] = useState<FormulaToken[]>([]);
  const [targetColumn, setTargetColumn] = useState('');
  const [draggedColumn, setDraggedColumn] = useState<string | null>(null);
  const [draggedSheet, setDraggedSheet] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState('');

  const operators = ['+', '-', '*', '/', '%', '(', ')', '='];
  const functions = ['SUM', 'AVG', 'MIN', 'MAX', 'ABS', 'ROUND'];

  const handleDragStart = (e: React.DragEvent, column: string, sheetName?: string) => {
    e.dataTransfer.effectAllowed = 'copy';
    setDraggedColumn(column);
    setDraggedSheet(sheetName || null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (draggedColumn) {
      // If from different sheet, add sheet prefix
      const columnRef = draggedSheet && draggedSheet !== 'Current Sheet' 
        ? `[${draggedSheet}.${draggedColumn}]`
        : `[${draggedColumn}]`;
      
      setFormula([...formula, { type: 'column', value: columnRef }]);
      setDraggedColumn(null);
      setDraggedSheet(null);
    }
  };

  const addToken = (type: FormulaToken['type'], value: string) => {
    setFormula([...formula, { type, value }]);
  };

  const removeToken = (index: number) => {
    setFormula(formula.filter((_, i) => i !== index));
  };

  const getFormulaString = (): string => {
    return formula
      .map(token => {
        if (token.type === 'column') return `[${token.value}]`;
        return token.value;
      })
      .join(' ');
  };

  const handleSave = () => {
    if (!targetColumn.trim()) {
      alert('Pilih kolom target');
      return;
    }
    if (formula.length === 0) {
      alert('Buat formula terlebih dahulu');
      return;
    }
    onSave(getFormulaString(), targetColumn);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6 space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold">Formula Editor</h2>
          <button 
            onClick={onCancel} 
            className="text-gray-500 hover:text-gray-700"
            title="Close"
            aria-label="Close formula editor"
          >
            <X size={24} />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-4">
          {/* Left: Available Columns */}
          <div className="space-y-3">
            <h3 className="font-semibold text-lg">Kolom Tersedia</h3>
            <div className="border-2 border-dashed border-blue-300 rounded p-4 bg-blue-50 min-h-[300px] overflow-y-auto space-y-3">
              {/* Current Sheet Columns */}
              <div>
                <p className="text-xs font-bold text-blue-700 mb-2 uppercase">Kolom Saat Ini</p>
                <div className="space-y-1">
                  {columns.map(col => (
                    <div
                      key={col}
                      draggable
                      onDragStart={e => handleDragStart(e, col, 'Current Sheet')}
                      className="bg-blue-500 text-white p-2 rounded cursor-move hover:bg-blue-600 transition text-sm"
                    >
                      {col}
                    </div>
                  ))}
                </div>
              </div>

              {/* Other Sheets Columns */}
              {allSheetColumns && allSheetColumns.length > 0 && (
                <>
                  <hr className="border-blue-200" />
                  {allSheetColumns.map(sheet => (
                    <div key={sheet.sheetName}>
                      <p className="text-xs font-bold text-purple-700 mb-2 uppercase">{sheet.sheetName}</p>
                      <div className="space-y-1">
                        {sheet.headers.map(col => (
                          <div
                            key={`${sheet.sheetName}.${col}`}
                            draggable
                            onDragStart={e => handleDragStart(e, col, sheet.sheetName)}
                            className="bg-purple-500 text-white p-2 rounded cursor-move hover:bg-purple-600 transition text-sm"
                            title={`From ${sheet.sheetName}`}
                          >
                            {col}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>

          {/* Middle: Formula Builder */}
          <div className="space-y-3">
            <h3 className="font-semibold text-lg">Formula Builder</h3>
            
            {/* Formula Preview */}
            <div
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              className="border-2 border-dashed border-gray-300 rounded p-4 bg-gray-50 min-h-[120px] flex flex-wrap gap-2 items-start content-start"
            >
              {formula.length === 0 ? (
                <span className="text-gray-400 text-sm">Drag kolom atau klik operator di bawah</span>
              ) : (
                formula.map((token, idx) => (
                  <button
                    key={idx}
                    onClick={() => removeToken(idx)}
                    className="bg-green-500 text-white px-2 py-1 rounded text-sm hover:bg-red-500 transition flex items-center gap-1"
                  >
                    {token.value}
                    <X size={14} />
                  </button>
                ))
              )}
            </div>

            {/* Formula String */}
            <div className="bg-gray-100 p-3 rounded font-mono text-sm overflow-x-auto">
              {getFormulaString() || 'Formula akan muncul di sini'}
            </div>

            {/* Quick Input */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Atau ketik manual:</label>
              <div className="flex gap-2">
                <Input
                  value={inputValue}
                  onChange={e => setInputValue(e.target.value)}
                  placeholder="Contoh: [GRUP] - 0.2 * [ASET_LANCAR]"
                  className="text-sm"
                />
                <Button
                  onClick={() => {
                    setFormula([{ type: 'column', value: inputValue }]);
                    setInputValue('');
                  }}
                  size="sm"
                >
                  <Plus size={16} />
                </Button>
              </div>
            </div>
          </div>

          {/* Right: Operators & Settings */}
          <div className="space-y-3">
            <div>
              <h3 className="font-semibold text-lg mb-2">Operator</h3>
              <div className="grid grid-cols-2 gap-2">
                {operators.map(op => (
                  <Button
                    key={op}
                    onClick={() => addToken('operator', op)}
                    variant="outline"
                    size="sm"
                    className="text-lg font-bold"
                  >
                    {op}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-lg mb-2">Fungsi</h3>
              <div className="space-y-1">
                {functions.map(fn => (
                  <Button
                    key={fn}
                    onClick={() => addToken('function', fn)}
                    variant="outline"
                    size="sm"
                    className="w-full justify-start"
                  >
                    {fn}()
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-lg mb-2">Kolom Target</h3>
              <select
                value={targetColumn}
                onChange={e => setTargetColumn(e.target.value)}
                className="w-full p-2 border rounded text-sm"
                title="Select target column"
                aria-label="Select target column"
              >
                <option value="">Pilih kolom...</option>
                {columns.map(col => (
                  <option key={col} value={col}>
                    {col}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2 pt-4">
              <Button onClick={handleSave} className="w-full bg-green-600 hover:bg-green-700">
                Simpan Formula
              </Button>
              <Button onClick={onCancel} variant="outline" className="w-full">
                Batal
              </Button>
            </div>
          </div>
        </div>

        {/* Help Text */}
        <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm">
          <p className="font-semibold mb-2">Cara Menggunakan:</p>
          <ul className="list-disc list-inside space-y-1 text-gray-700">
            <li>Drag kolom dari daftar kiri ke area formula di tengah</li>
            <li>Klik operator atau fungsi untuk menambahkan ke formula</li>
            <li>Formula akan otomatis diperbarui setiap saat</li>
            <li>Contoh: [GRUP_NILAI] - 0.2 * [ASET_LANCAR]</li>
            <li>Jangan lupa pilih kolom target di sebelah kanan</li>
          </ul>
        </div>

        {/* Special Handling for Nilai Rangking Liabilities */}
        {targetColumn.toLowerCase().includes('rangking') && targetColumn.toLowerCase().includes('liabilities') && (
          <div className="bg-amber-50 border border-amber-300 rounded p-3 text-sm">
            <p className="font-semibold text-amber-900 mb-2">⚠️ Nilai Rangking Liabilities - Logika Khusus</p>
            <p className="text-amber-800">
              Kolom ini akan otomatis diset menjadi <strong>0</strong> jika:
            </p>
            <p className="text-amber-800 ml-4 mt-1">
              <strong>Persentase Nilai Pasar Wajar Terhadap Total Modal Sendiri &lt; 0.20 (20%)</strong>
            </p>
            <p className="text-amber-800 mt-2">
              Jika persentase ≥ 0.20, maka formula di atas akan digunakan untuk perhitungan.
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}
