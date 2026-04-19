import type { GarageService, GarageServiceType } from '@/modules/garage/types/garage';
import { normalizeGarageServiceName, trimGarageServiceName } from '@/modules/garage/lib/serviceNames';
import { getGarageServiceTypeLabel, parseGarageServiceTypeLabel } from '@/modules/garage/lib/serviceTypes';

export const GARAGE_SERVICE_IMPORT_HEADERS = [
  'Name',
  'Type',
  'Every (Miles)',
  'Every (Months)',
  'Monitoring',
  'Notes',
] as const;

type GarageServiceImportHeader = typeof GARAGE_SERVICE_IMPORT_HEADERS[number];

export interface GarageServiceImportRpcRow {
  name: string;
  type?: GarageServiceType | null;
  every_miles?: number | null;
  every_months?: number | null;
  monitoring?: boolean;
  notes?: string | null;
}

export interface GarageServiceImportPreviewRow {
  rowNumber: number;
  name: string;
  action: 'add' | 'update';
  targetServiceId: string | null;
  fieldSummaries: string[];
  rpcRow: GarageServiceImportRpcRow;
}

export interface GarageServiceImportInvalidRow {
  rowNumber: number;
  name: string;
  reasons: string[];
}

export interface GarageServiceImportIgnoredDuplicateRow {
  rowNumber: number;
  name: string;
  replacedByRowNumber: number;
}

export interface GarageServiceImportPreview {
  additions: GarageServiceImportPreviewRow[];
  updates: GarageServiceImportPreviewRow[];
  invalidRows: GarageServiceImportInvalidRow[];
  ignoredDuplicateRows: GarageServiceImportIgnoredDuplicateRow[];
  ignoredHeaders: string[];
  rowsToImport: GarageServiceImportRpcRow[];
}

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

function parsePositiveInteger(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return { ok: true as const, value: null };
  if (!/^\d+$/.test(trimmed)) {
    return { ok: false as const, reason: 'must be a positive whole number or blank' };
  }

  const parsed = Number(trimmed);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    return { ok: false as const, reason: 'must be a positive whole number or blank' };
  }

  return { ok: true as const, value: parsed };
}

function parseMonitoringValue(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return { ok: true as const, value: null };
  if (trimmed === 'TRUE') return { ok: true as const, value: true };
  if (trimmed === 'FALSE') return { ok: true as const, value: false };
  return { ok: false as const, reason: 'must be exactly TRUE, FALSE, or blank' };
}

function buildExistingServicesByName(services: GarageService[]) {
  const byNormalizedName = new Map<string, GarageService[]>();

  for (const service of services) {
    const normalized = normalizeGarageServiceName(service.name);
    if (!normalized) continue;
    const existing = byNormalizedName.get(normalized) ?? [];
    existing.push(service);
    byNormalizedName.set(normalized, existing);
  }

  return byNormalizedName;
}

function getFieldSummaries(args: {
  existingService: GarageService | null;
  nextName: string;
  nextType: GarageServiceType | null;
  providedType: boolean;
  nextEveryMiles: number | null;
  providedEveryMiles: boolean;
  nextEveryMonths: number | null;
  providedEveryMonths: boolean;
  nextMonitoring: boolean;
  providedMonitoring: boolean;
  nextNotes: string | null;
  providedNotes: boolean;
}) {
  const {
    existingService,
    nextName,
    nextType,
    providedType,
    nextEveryMiles,
    providedEveryMiles,
    nextEveryMonths,
    providedEveryMonths,
    nextMonitoring,
    providedMonitoring,
    nextNotes,
    providedNotes,
  } = args;
  const fieldSummaries: string[] = [];

  if (!existingService || trimGarageServiceName(existingService.name) !== nextName) {
    fieldSummaries.push(`Name: ${nextName}`);
  }
  if (!existingService || providedType) {
    fieldSummaries.push(`Type: ${getGarageServiceTypeLabel(nextType)}`);
  }
  if (!existingService || providedEveryMiles) {
    fieldSummaries.push(`Every (Miles): ${nextEveryMiles === null ? '—' : String(nextEveryMiles)}`);
  }
  if (!existingService || providedEveryMonths) {
    fieldSummaries.push(`Every (Months): ${nextEveryMonths === null ? '—' : String(nextEveryMonths)}`);
  }
  if (!existingService || providedMonitoring) {
    fieldSummaries.push(`Monitoring: ${nextMonitoring ? 'TRUE' : 'FALSE'}`);
  }
  if (!existingService || providedNotes) {
    fieldSummaries.push(`Notes: ${nextNotes ?? '—'}`);
  }

  if (fieldSummaries.length === 0) {
    fieldSummaries.push('No visible field changes');
  }

  return fieldSummaries;
}

export function buildGarageServiceTemplateCsv() {
  return `${GARAGE_SERVICE_IMPORT_HEADERS.join(',')}\r\n`;
}

export function buildGarageServiceImportPreview(csvText: string, services: GarageService[]): GarageServiceImportPreview {
  const rows = parseCsvRows(csvText);
  if (rows.length === 0) {
    throw new Error('CSV file is empty.');
  }

  const headerRow = rows[0] ?? [];
  const knownHeaderIndexes = new Map<GarageServiceImportHeader, number>();
  const ignoredHeaders: string[] = [];

  headerRow.forEach((header, index) => {
    if (GARAGE_SERVICE_IMPORT_HEADERS.includes(header as GarageServiceImportHeader) && !knownHeaderIndexes.has(header as GarageServiceImportHeader)) {
      knownHeaderIndexes.set(header as GarageServiceImportHeader, index);
      return;
    }
    if (header.length > 0) {
      ignoredHeaders.push(header);
    }
  });

  const existingServicesByName = buildExistingServicesByName(services);
  const lastRowNumberByNormalizedName = new Map<string, number>();

  rows.slice(1).forEach((row, index) => {
    const nameIndex = knownHeaderIndexes.get('Name');
    const rawName = nameIndex === undefined ? '' : (row[nameIndex] ?? '');
    const normalizedName = normalizeGarageServiceName(rawName);
    if (!normalizedName) return;
    lastRowNumberByNormalizedName.set(normalizedName, index + 2);
  });

  const additions: GarageServiceImportPreviewRow[] = [];
  const updates: GarageServiceImportPreviewRow[] = [];
  const invalidRows: GarageServiceImportInvalidRow[] = [];
  const ignoredDuplicateRows: GarageServiceImportIgnoredDuplicateRow[] = [];

  rows.slice(1).forEach((row, index) => {
    const rowNumber = index + 2;
    if (row.every((cell) => cell.trim().length === 0)) {
      return;
    }

    const nameIndex = knownHeaderIndexes.get('Name');
    const typeIndex = knownHeaderIndexes.get('Type');
    const everyMilesIndex = knownHeaderIndexes.get('Every (Miles)');
    const everyMonthsIndex = knownHeaderIndexes.get('Every (Months)');
    const monitoringIndex = knownHeaderIndexes.get('Monitoring');
    const notesIndex = knownHeaderIndexes.get('Notes');

    const rawName = nameIndex === undefined ? '' : (row[nameIndex] ?? '');
    const trimmedName = trimGarageServiceName(rawName);
    const normalizedName = normalizeGarageServiceName(rawName);

    if (normalizedName && lastRowNumberByNormalizedName.get(normalizedName) !== rowNumber) {
      ignoredDuplicateRows.push({
        rowNumber,
        name: trimmedName,
        replacedByRowNumber: lastRowNumberByNormalizedName.get(normalizedName) ?? rowNumber,
      });
      return;
    }

    const reasons: string[] = [];
    if (nameIndex === undefined) {
      reasons.push('The required Name header is missing.');
    } else if (!trimmedName) {
      reasons.push('Name is required.');
    }

    const matchingServices = normalizedName ? (existingServicesByName.get(normalizedName) ?? []) : [];
    if (matchingServices.length > 1) {
      reasons.push('Existing services contain multiple rows with this Name.');
    }

    const rawType = typeIndex === undefined ? '' : (row[typeIndex] ?? '');
    const parsedType = parseGarageServiceTypeLabel(rawType);
    if (rawType.trim().length > 0 && parsedType === undefined) {
      reasons.push('Type must be blank or exactly Replacement, Clean/Lube, Adjustment, or Check.');
    }

    const rawEveryMiles = everyMilesIndex === undefined ? '' : (row[everyMilesIndex] ?? '');
    const parsedEveryMiles = parsePositiveInteger(rawEveryMiles);
    if (!parsedEveryMiles.ok) {
      reasons.push(`Every (Miles) ${parsedEveryMiles.reason}.`);
    }

    const rawEveryMonths = everyMonthsIndex === undefined ? '' : (row[everyMonthsIndex] ?? '');
    const parsedEveryMonths = parsePositiveInteger(rawEveryMonths);
    if (!parsedEveryMonths.ok) {
      reasons.push(`Every (Months) ${parsedEveryMonths.reason}.`);
    }

    const rawMonitoring = monitoringIndex === undefined ? '' : (row[monitoringIndex] ?? '');
    const parsedMonitoring = parseMonitoringValue(rawMonitoring);
    if (!parsedMonitoring.ok) {
      reasons.push(`Monitoring ${parsedMonitoring.reason}.`);
    }

    if (reasons.length > 0) {
      invalidRows.push({
        rowNumber,
        name: trimmedName,
        reasons,
      });
      return;
    }

    const existingService = matchingServices[0] ?? null;
    const providedType = rawType.trim().length > 0;
    const providedEveryMiles = rawEveryMiles.trim().length > 0;
    const providedEveryMonths = rawEveryMonths.trim().length > 0;
    const providedMonitoring = rawMonitoring.trim().length > 0;
    const rawNotes = notesIndex === undefined ? '' : (row[notesIndex] ?? '');
    const trimmedNotes = rawNotes.trim();
    const providedNotes = trimmedNotes.length > 0;

    const rpcRow: GarageServiceImportRpcRow = { name: trimmedName };
    if (providedType) rpcRow.type = parsedType ?? null;
    if (providedEveryMiles) rpcRow.every_miles = parsedEveryMiles.value;
    if (providedEveryMonths) rpcRow.every_months = parsedEveryMonths.value;
    if (providedMonitoring) rpcRow.monitoring = parsedMonitoring.value ?? false;
    if (providedNotes) rpcRow.notes = trimmedNotes;

    const previewRow: GarageServiceImportPreviewRow = {
      rowNumber,
      name: trimmedName,
      action: existingService ? 'update' : 'add',
      targetServiceId: existingService?.id ?? null,
      fieldSummaries: getFieldSummaries({
        existingService,
        nextName: trimmedName,
        nextType: providedType ? (parsedType ?? null) : (existingService?.type ?? null),
        providedType,
        nextEveryMiles: providedEveryMiles ? parsedEveryMiles.value : (existingService?.every_miles ?? null),
        providedEveryMiles,
        nextEveryMonths: providedEveryMonths ? parsedEveryMonths.value : (existingService?.every_months ?? null),
        providedEveryMonths,
        nextMonitoring: providedMonitoring ? (parsedMonitoring.value ?? false) : (existingService?.monitoring ?? false),
        providedMonitoring,
        nextNotes: providedNotes ? trimmedNotes : (existingService?.notes ?? null),
        providedNotes,
      }),
      rpcRow,
    };

    if (previewRow.action === 'add') {
      additions.push(previewRow);
    } else {
      updates.push(previewRow);
    }
  });

  return {
    additions,
    updates,
    invalidRows,
    ignoredDuplicateRows,
    ignoredHeaders,
    rowsToImport: [...additions, ...updates].map((row) => row.rpcRow),
  };
}
