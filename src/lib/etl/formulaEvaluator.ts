/**
 * Formula Parser & Evaluator
 * Mengevaluasi formula dengan column references
 * Format: [COLUMN_NAME] + [OTHER_COLUMN] * 0.2
 */

export interface FormulaResult {
  success: boolean;
  value: number | null;
  error?: string;
}

/**
 * Evaluate formula for a single row
 * @param formula - Formula string with [COLUMN] or [SHEET.COLUMN] references
 * @param rowData - The data row
 * @param additionalContext - Optional additional row data from other sheets (for cross-sheet references)
 * @returns Calculated value or null if error
 */
export function evaluateFormula(
  formula: string,
  rowData: Record<string, unknown>,
  additionalContext?: Record<string, Record<string, unknown>>
): FormulaResult {
  try {
    // Replace [COLUMN_NAME] or [SHEET.COLUMN_NAME] with actual values
    let expression = formula;
    const columnMatches = formula.match(/\[([^\]]+)\]/g);

    if (!columnMatches) {
      return {
        success: false,
        value: null,
        error: 'Formula tidak mengandung referensi kolom'
      };
    }

    columnMatches.forEach(match => {
      const columnRef = match.slice(1, -1); // Remove [ ]
      let value: unknown;

      // Check if this is a cross-sheet reference (SHEET.COLUMN)
      if (columnRef.includes('.')) {
        const [sheetName, columnName] = columnRef.split('.');
        if (additionalContext && additionalContext[sheetName]) {
          value = additionalContext[sheetName][columnName];
        } else {
          throw new Error(`Sheet "${sheetName}" atau kolom "${columnName}" tidak ditemukan`);
        }
      } else {
        // Regular column reference from same row
        value = rowData[columnRef];
      }
      
      if (value === null || value === undefined) {
        throw new Error(`Kolom "${columnRef}" tidak ditemukan atau nilai null`);
      }

      const numValue = parseFloat(String(value));
      if (isNaN(numValue)) {
        throw new Error(`Nilai pada kolom "${columnRef}" bukan angka: ${value}`);
      }

      expression = expression.replace(match, String(numValue));
    });

    // Validate expression (prevent injection)
    if (!isValidExpression(expression)) {
      throw new Error('Formula tidak valid atau mengandung karakter berbahaya');
    }

    // Evaluate the expression
    // Using Function constructor is safer than eval for controlled input
    const result = Function('"use strict"; return (' + expression + ')')();

    if (typeof result !== 'number' || isNaN(result)) {
      throw new Error('Hasil formula bukan angka yang valid');
    }

    return {
      success: true,
      value: result,
    };
  } catch (error) {
    return {
      success: false,
      value: null,
      error: error instanceof Error ? error.message : 'Error tidak diketahui',
    };
  }
}

/**
 * Validate that expression only contains safe characters
 */
function isValidExpression(expression: string): boolean {
  // Allow: numbers, operators, parentheses, decimal points, spaces
  const allowedPattern = /^[\d\s+\-*/%().]+$/;
  return allowedPattern.test(expression);
}

/**
 * Evaluate formula for multiple rows
 */
export function evaluateFormulaForRows(
  formula: string,
  rows: Record<string, unknown>[],
  targetColumn: string
): {
  updatedRows: Record<string, unknown>[];
  successCount: number;
  errorCount: number;
  errors: Array<{ rowIndex: number; error: string }>;
} {
  const updatedRows = [...rows];
  let successCount = 0;
  let errorCount = 0;
  const errors: Array<{ rowIndex: number; error: string }> = [];

  // Check if this is Nilai Rangking Liabilities column (special handling)
  const isNilaiRankingColumn = targetColumn.toLowerCase().includes('rangking') && 
                               targetColumn.toLowerCase().includes('liabilities');
  
  // Find persentase column for Nilai Rangking special logic
  let persentaseColumn: string | null = null;
  if (isNilaiRankingColumn) {
    persentaseColumn = Object.keys(rows[0] || {}).find(col => {
      const lower = col.toLowerCase();
      return (lower.includes('persentase') || lower.includes('persen')) &&
             (lower.includes('pasar') || lower.includes('modal'));
    }) || null;
  }

  rows.forEach((row, idx) => {
    try {
      // Special handling for Nilai Rangking Liabilities
      if (isNilaiRankingColumn && persentaseColumn) {
        const persentaseValue = parseFloat(String(row[persentaseColumn] || 0));
        
        // If persentase < 0.20 (20%), set to 0
        if (persentaseValue < 0.20) {
          updatedRows[idx] = { ...row, [targetColumn]: 0 };
          successCount++;
          console.log(`Row ${idx + 1}: Nilai Rangking set to 0 (Persentase ${persentaseValue} < 0.20)`);
          return;
        }
      }

      // Normal formula evaluation
      const result = evaluateFormula(formula, row);
      if (result.success && result.value !== null) {
        updatedRows[idx] = { ...row, [targetColumn]: result.value };
        successCount++;
      } else {
        errorCount++;
        errors.push({
          rowIndex: idx + 1, // 1-based for display
          error: result.error || 'Unknown error'
        });
      }
    } catch (error) {
      errorCount++;
      errors.push({
        rowIndex: idx + 1,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  return {
    updatedRows,
    successCount,
    errorCount,
    errors,
  };
}

/**
 * Test formula with sample data before applying to all rows
 */
export function testFormula(
  formula: string,
  sampleRow: Record<string, unknown>
): {
  success: boolean;
  result?: number;
  error?: string;
  expression?: string;
} {
  try {
    const columnMatches = formula.match(/\[([^\]]+)\]/g);
    let expression = formula;

    if (!columnMatches) {
      return {
        success: false,
        error: 'Formula tidak mengandung referensi kolom'
      };
    }

    // Show what expression will be evaluated
    columnMatches.forEach(match => {
      const columnName = match.slice(1, -1);
      const value = sampleRow[columnName];
      
      if (value === null || value === undefined) {
        throw new Error(`Kolom "${columnName}" tidak ada pada data sample`);
      }

      const numValue = parseFloat(String(value));
      if (isNaN(numValue)) {
        throw new Error(`Nilai pada kolom "${columnName}" bukan angka: ${value}`);
      }

      expression = expression.replace(match, String(numValue));
    });

    if (!isValidExpression(expression)) {
      return {
        success: false,
        error: 'Formula tidak valid'
      };
    }

    const result = Function('"use strict"; return (' + expression + ')')();

    return {
      success: true,
      result: result as number,
      expression: expression,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error tidak diketahui'
    };
  }
}
