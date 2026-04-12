function parseCsvRows(csvText: string): string[][] {
  const rows: string[][] = [];
  const normalizedText = csvText.replace(/^\uFEFF/, '');
  let currentRow: string[] = [];
  let currentValue = '';
  let inQuotes = false;

  for (let index = 0; index < normalizedText.length; index += 1) {
    const char = normalizedText[index];

    if (inQuotes) {
      if (char === '"') {
        if (normalizedText[index + 1] === '"') {
          currentValue += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        currentValue += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }

    if (char === ',') {
      currentRow.push(currentValue);
      currentValue = '';
      continue;
    }

    if (char === '\r') {
      if (normalizedText[index + 1] === '\n') {
        index += 1;
      }
      currentRow.push(currentValue);
      rows.push(currentRow);
      currentRow = [];
      currentValue = '';
      continue;
    }

    if (char === '\n') {
      currentRow.push(currentValue);
      rows.push(currentRow);
      currentRow = [];
      currentValue = '';
      continue;
    }

    currentValue += char;
  }

  currentRow.push(currentValue);
  if (rows.length > 0 || currentRow.some((cell) => cell.length > 0)) {
    rows.push(currentRow);
  }

  return rows;
}

export function extractEstimatorTicketTitlesFromCsv(csvText: string, columnName: string): string[] {
  const trimmedColumnName = columnName.trim();
  if (!trimmedColumnName) {
    throw new Error('Ticket column name is required.');
  }

  const rows = parseCsvRows(csvText).filter((row) => row.some((cell) => cell.trim().length > 0));
  if (rows.length === 0) {
    throw new Error('CSV file is empty.');
  }

  const headerRow = rows[0].map((cell) => cell.trim());
  const columnIndex = headerRow.findIndex((cell) => cell === trimmedColumnName);
  if (columnIndex < 0) {
    throw new Error(`Column "${trimmedColumnName}" was not found in the CSV file.`);
  }

  const titles = rows
    .slice(1)
    .map((row) => row[columnIndex] ?? '')
    .map((cell) => cell.trim())
    .filter((cell) => cell.length > 0);

  if (titles.length === 0) {
    throw new Error(`No ticket names were found in column "${trimmedColumnName}".`);
  }

  return titles;
}
