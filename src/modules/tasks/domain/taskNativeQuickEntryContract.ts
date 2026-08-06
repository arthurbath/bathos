import {
  taskNativeQuickEntryContract,
  taskNativeQuickEntryContractFingerprint,
} from '@/modules/tasks/domain/taskNativeQuickEntryContract.generated';

export { taskNativeQuickEntryContractFingerprint };

export type TaskNativeQuickEntryFieldId =
  (typeof taskNativeQuickEntryContract.fields)[number]['id'];
export type TaskNativeQuickEntryCommandName =
  (typeof taskNativeQuickEntryContract.commands)[number]['command'];
export type TaskNativeQuickEntryLayoutSectionId =
  (typeof taskNativeQuickEntryContract.layoutSections)[number]['id'];

export const TASK_NATIVE_QUICK_ENTRY_SCHEMA_VERSION =
  taskNativeQuickEntryContract.schemaVersion;
export const TASK_NATIVE_QUICK_ENTRY_PAYLOAD_SCHEMA_VERSION =
  taskNativeQuickEntryContract.payloadSchemaVersion;
export const TASK_NATIVE_QUICK_ENTRY_CAPABILITY =
  taskNativeQuickEntryContract.capability;
export const TASK_NATIVE_QUICK_ENTRY_DEFAULTS =
  taskNativeQuickEntryContract.defaults;
export const TASK_NATIVE_QUICK_ENTRY_FIELDS =
  taskNativeQuickEntryContract.fields;
export const TASK_NATIVE_QUICK_ENTRY_LAYOUT_SECTIONS =
  taskNativeQuickEntryContract.layoutSections;
export const TASK_NATIVE_QUICK_ENTRY_TODAY_SECTIONS =
  taskNativeQuickEntryContract.todaySections;
export const TASK_NATIVE_QUICK_ENTRY_ACTIONABILITIES =
  taskNativeQuickEntryContract.actionabilities;
export const TASK_NATIVE_QUICK_ENTRY_COMMANDS =
  taskNativeQuickEntryContract.commands;
export const TASK_NATIVE_QUICK_ENTRY_LIMITS =
  taskNativeQuickEntryContract.limits;
export const TASK_NATIVE_QUICK_ENTRY_RULES =
  taskNativeQuickEntryContract.rules;

export function getTaskNativeQuickEntryField(
  fieldId: TaskNativeQuickEntryFieldId,
) {
  const field = TASK_NATIVE_QUICK_ENTRY_FIELDS.find(({ id }) => id === fieldId);
  if (field === undefined) {
    throw new Error(`Unknown native Quick Entry field: ${fieldId}`);
  }
  return field;
}

export function getTaskNativeQuickEntryFieldLabel(
  fieldId: TaskNativeQuickEntryFieldId,
): string {
  return getTaskNativeQuickEntryField(fieldId).label;
}

export function getTaskNativeQuickEntryCreationPlacement() {
  return { todaySection: TASK_NATIVE_QUICK_ENTRY_DEFAULTS.todaySection } as const;
}

export function normalizeTaskNativeQuickEntrySummary(value: string): string {
  const normalized = value.trim();
  const limit = getTaskNativeQuickEntryField('summary').maximumCharacters;
  if (normalized.length === 0) {
    throw new Error('A task summary is required');
  }
  if (limit !== null && Array.from(normalized).length > limit) {
    throw new Error(`A task summary cannot exceed ${limit} characters`);
  }
  return normalized;
}

export function normalizeTaskNativeQuickEntryChecklist(
  values: readonly string[],
): string[] {
  const itemLimit = getTaskNativeQuickEntryField('checklist').maximumCharacters;
  const normalized = values
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  if (normalized.length > TASK_NATIVE_QUICK_ENTRY_LIMITS.maximumChecklistItems) {
    throw new Error(
      `A task checklist cannot exceed ${TASK_NATIVE_QUICK_ENTRY_LIMITS.maximumChecklistItems} items`,
    );
  }
  if (
    itemLimit !== null
    && normalized.some((value) => Array.from(value).length > itemLimit)
  ) {
    throw new Error(`A checklist item cannot exceed ${itemLimit} characters`);
  }
  return normalized;
}
