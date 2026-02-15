import { useRef, useCallback } from 'react';

/**
 * Spreadsheet-style keyboard navigation for tables.
 * - Tab: move to next editable cell to the right (wraps to next row)
 * - Enter: move to same column in next row (uses last mouse-clicked column)
 *
 * Usage:
 *   const { tableRef, onCellKeyDown, onCellMouseDown } = useSpreadsheetNav();
 *   <div ref={tableRef}> ... table ... </div>
 *   On each editable cell: data-row={rowIdx} data-col={colIdx}
 *   onKeyDown={onCellKeyDown} onMouseDown={onCellMouseDown}
 */
export function useSpreadsheetNav() {
  const tableRef = useRef<HTMLDivElement>(null);
  const lastClickedCol = useRef<number>(0);

  const getEditableCells = useCallback(() => {
    if (!tableRef.current) return [];
    return Array.from(
      tableRef.current.querySelectorAll<HTMLElement>('[data-row][data-col]')
    );
  }, []);

  const focusCell = useCallback((row: number, col: number) => {
    const cells = getEditableCells();
    const target = cells.find(
      el => Number(el.dataset.row) === row && Number(el.dataset.col) === col
    );
    if (target) {
      // For CurrencyCell/PercentCell buttons, click to activate the input
      // But not for checkboxes or select triggers — just focus those
      const role = target.getAttribute('role');
      if (target.tagName === 'BUTTON' && role !== 'checkbox' && role !== 'combobox') {
        target.click();
      } else {
        target.focus();
      }
      return true;
    }
    return false;
  }, [getEditableCells]);

  const getMaxRow = useCallback(() => {
    const cells = getEditableCells();
    let max = -1;
    for (const c of cells) {
      const r = Number(c.dataset.row);
      if (r > max) max = r;
    }
    return max;
  }, [getEditableCells]);

  const getMaxCol = useCallback((row: number) => {
    const cells = getEditableCells();
    let max = -1;
    for (const c of cells) {
      if (Number(c.dataset.row) === row) {
        const col = Number(c.dataset.col);
        if (col > max) max = col;
      }
    }
    return max;
  }, [getEditableCells]);

  const getMinCol = useCallback((row: number) => {
    const cells = getEditableCells();
    let min = Infinity;
    for (const c of cells) {
      if (Number(c.dataset.row) === row) {
        const col = Number(c.dataset.col);
        if (col < min) min = col;
      }
    }
    return min === Infinity ? 0 : min;
  }, [getEditableCells]);

  const findNextCol = useCallback((row: number, currentCol: number) => {
    const cells = getEditableCells();
    // Get all cols for this row, sorted
    const cols = cells
      .filter(c => Number(c.dataset.row) === row)
      .map(c => Number(c.dataset.col))
      .sort((a, b) => a - b);
    const nextIdx = cols.findIndex(c => c > currentCol);
    if (nextIdx !== -1) return { row, col: cols[nextIdx] };
    // Wrap to next row
    const maxRow = getMaxRow();
    const nextRow = row < maxRow ? row + 1 : 0;
    const minCol = getMinCol(nextRow);
    return { row: nextRow, col: minCol };
  }, [getEditableCells, getMaxRow, getMinCol]);

  const onCellKeyDown = useCallback((e: React.KeyboardEvent<HTMLElement>) => {
    const target = e.currentTarget;
    const row = Number(target.dataset.row);
    const col = Number(target.dataset.col);
    if (isNaN(row) || isNaN(col)) return;

    if (e.key === 'Tab') {
      e.preventDefault();
      // Commit current value by blurring
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      // Small delay to let blur/commit happen
      requestAnimationFrame(() => {
        const next = findNextCol(row, col);
        focusCell(next.row, next.col);
      });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      const targetCol = lastClickedCol.current;
      const maxRow = getMaxRow();
      const nextRow = row < maxRow ? row + 1 : 0;
      requestAnimationFrame(() => {
        // Try the last-clicked column, fall back to same column
        if (!focusCell(nextRow, targetCol)) {
          focusCell(nextRow, col);
        }
      });
    }
  }, [findNextCol, focusCell, getMaxRow]);

  const onCellMouseDown = useCallback((e: React.MouseEvent<HTMLElement>) => {
    const col = Number(e.currentTarget.dataset.col);
    if (!isNaN(col)) lastClickedCol.current = col;
  }, []);

  return { tableRef, onCellKeyDown, onCellMouseDown };
}
