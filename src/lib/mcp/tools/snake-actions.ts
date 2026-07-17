import { defineTool, z } from "../mcp-core";
import { nowIso, requireAuthenticated, resolveSnakeHousehold, toMcpResult } from "../supabase";
import { emptyToNull, jsonObjectSchema, objectData, operationSchema, requireId, stripOwnerFields, trimString, uuidSchema, withUpdatedAt } from "../resource-utils";

const snakeResourceSchema = z.enum(["snakes", "weight_records", "growth_expectation_ranges"]);

async function getSnakeData(input: {
  resource: z.infer<typeof snakeResourceSchema>;
  household_id?: string;
  snake_id?: string;
  id?: string;
  limit?: number;
}, auth: ReturnType<typeof requireAuthenticated>) {
  if (input.resource === "growth_expectation_ranges") {
    const { data, error } = await auth.supabase
      .from("snake_growth_expectation_ranges")
      .select("*")
      .order("profile", { ascending: true })
      .order("sort_order", { ascending: true });
    if (error) throw new Error(error.message);
    return data;
  }

  const householdId = await resolveSnakeHousehold(auth, input.household_id);

  if (input.resource === "snakes") {
    let query = auth.supabase.from("snake_snakes").select("*").eq("household_id", householdId);
    if (input.id) query = query.eq("id", input.id);
    const { data, error } = await query.order("sort_order", { ascending: true }).order("created_at", { ascending: true }).limit(input.limit ?? 500);
    if (error) throw new Error(error.message);
    return data;
  }

  let query = auth.supabase.from("snake_weight_records").select("*").eq("household_id", householdId);
  if (input.snake_id) query = query.eq("snake_id", input.snake_id);
  if (input.id) query = query.eq("id", input.id);
  const { data, error } = await query.order("recorded_on", { ascending: false }).order("created_at", { ascending: false }).limit(input.limit ?? 500);
  if (error) throw new Error(error.message);
  return data;
}

async function setSnakeData(input: {
  resource: z.infer<typeof snakeResourceSchema>;
  operation: z.infer<typeof operationSchema>;
  household_id?: string;
  snake_id?: string;
  id?: string;
  data?: Record<string, unknown>;
}, auth: ReturnType<typeof requireAuthenticated>) {
  if (input.resource === "growth_expectation_ranges") {
    throw new Error("growth_expectation_ranges is read-only.");
  }

  requireId(input.operation, input.id);
  const householdId = await resolveSnakeHousehold(auth, input.household_id);
  const raw = objectData(input.data);
  const clean = stripOwnerFields(raw);

  if (input.resource === "snakes") {
    const normalized = {
      ...clean,
      name: trimString(clean.name),
      species: typeof clean.species === "string" ? clean.species.trim() || "Ball Python" : clean.species,
      growth_profile: typeof clean.growth_profile === "string" ? clean.growth_profile.trim() || "ball_python" : clean.growth_profile,
      morph: emptyToNull(clean.morph),
      notes: emptyToNull(clean.notes),
    };

    if (input.operation === "create") {
      const { data, error } = await auth.supabase
        .from("snake_snakes")
        .insert({ ...normalized, household_id: householdId })
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      return data;
    }

    if (input.operation === "update") {
      const { data, error } = await auth.supabase
        .from("snake_snakes")
        .update(withUpdatedAt(normalized, nowIso()))
        .eq("id", input.id!)
        .eq("household_id", householdId)
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      return data;
    }

    const { error } = await auth.supabase.from("snake_snakes").delete().eq("id", input.id!).eq("household_id", householdId);
    if (error) throw new Error(error.message);
    return { deleted: true, resource: input.resource, id: input.id };
  }

  const snakeId = input.snake_id ?? (typeof raw.snake_id === "string" ? raw.snake_id : undefined);
  if (!snakeId) throw new Error("weight_records requires snake_id.");

  if (input.operation === "create") {
    const { data, error } = await auth.supabase
      .from("snake_weight_records")
      .insert({ ...clean, household_id: householdId, snake_id: snakeId })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return data;
  }

  if (input.operation === "update") {
    const { data, error } = await auth.supabase
      .from("snake_weight_records")
      .update(withUpdatedAt(clean, nowIso()))
      .eq("id", input.id!)
      .eq("household_id", householdId)
      .eq("snake_id", snakeId)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return data;
  }

  const { error } = await auth.supabase
    .from("snake_weight_records")
    .delete()
    .eq("id", input.id!)
    .eq("household_id", householdId)
    .eq("snake_id", snakeId);
  if (error) throw new Error(error.message);
  return { deleted: true, resource: input.resource, id: input.id };
}

export const getSnake = defineTool({
  name: "get_snake",
  title: "Get Snake Data",
  description: "Read snakes, weight records, or growth expectation ranges for an accessible Snake household.",
  inputSchema: {
    resource: snakeResourceSchema,
    household_id: uuidSchema.optional().describe("Optional accessible Snake household id."),
    snake_id: uuidSchema.optional().describe("Optional snake id for weight records."),
    id: uuidSchema.optional().describe("Optional record id to narrow the result."),
    limit: z.number().int().min(1).max(500).optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: (input, ctx) => toMcpResult(getSnakeData(input, requireAuthenticated(ctx))),
});

export const setSnake = defineTool({
  name: "set_snake",
  title: "Set Snake Data",
  description: "Create, update, or delete snakes and weight records for an accessible Snake household.",
  inputSchema: {
    resource: z.enum(["snakes", "weight_records"]),
    operation: operationSchema,
    household_id: uuidSchema.optional(),
    snake_id: uuidSchema.optional().describe("Required for weight record mutations."),
    id: uuidSchema.optional().describe("Record id required for update and delete."),
    data: jsonObjectSchema.optional().describe("Record fields for create or update. Owner fields are ignored."),
  },
  annotations: { readOnlyHint: false, idempotentHint: false, openWorldHint: false },
  handler: (input, ctx) => toMcpResult(setSnakeData(input, requireAuthenticated(ctx))),
});
