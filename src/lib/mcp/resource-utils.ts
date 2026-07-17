import { z } from "./mcp-core";

export const operationSchema = z.enum(["create", "update", "delete"]);

export const uuidSchema = z.string().uuid();

export const jsonObjectSchema = z.record(z.unknown());

export function requireId(operation: string, id?: string) {
  if ((operation === "update" || operation === "delete") && !id) {
    throw new Error(`${operation} requires id.`);
  }
}

export function objectData(data: Record<string, unknown> | undefined) {
  return data ?? {};
}

export function stripOwnerFields<T extends Record<string, unknown>>(data: T) {
  const {
    id: _id,
    user_id: _userId,
    household_id: _householdId,
    created_at: _createdAt,
    updated_at: _updatedAt,
    ...rest
  } = data;
  return rest;
}

export function emptyToNull(value: unknown) {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function trimString(value: unknown) {
  return typeof value === "string" ? value.trim() : value;
}

export function withUpdatedAt(data: Record<string, unknown>, now: string) {
  return { ...data, updated_at: now };
}
