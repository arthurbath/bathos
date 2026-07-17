import { defineTool, z } from "../mcp-core";
import { nowIso, requireAuthenticated, toMcpResult } from "../supabase";
import { emptyToNull, jsonObjectSchema, objectData, operationSchema, requireId, stripOwnerFields, uuidSchema, withUpdatedAt } from "../resource-utils";

const wardrobeCategorySchema = z.enum(["tops", "bottoms", "footwear", "outerwear", "underwear", "accessories"]);

const wardrobeStatusSchema = z.enum([
  "active",
  "needs_modulation",
  "endangered",
  "seeking_replacement",
  "pending_removal",
  "costume",
  "removed",
]);

function normalizeItem(data: Record<string, unknown>) {
  return {
    ...data,
    name: emptyToNull(data.name),
    brand: emptyToNull(data.brand),
    model: emptyToNull(data.model),
    color: emptyToNull(data.color),
    size: emptyToNull(data.size),
    link_url: emptyToNull(data.link_url),
    notes: emptyToNull(data.notes),
  };
}

async function getWardrobeData(input: {
  id?: string;
  status?: z.infer<typeof wardrobeStatusSchema>;
  category?: z.infer<typeof wardrobeCategorySchema>;
  limit?: number;
}, auth: ReturnType<typeof requireAuthenticated>) {
  let query = auth.supabase.from("wardrobe_items").select("*").eq("user_id", auth.userId);
  if (input.id) query = query.eq("id", input.id);
  if (input.status) query = query.eq("status", input.status);
  if (input.category) query = query.eq("category", input.category);
  const { data, error } = await query.order("created_at", { ascending: true }).limit(input.limit ?? 500);
  if (error) throw new Error(error.message);
  return data;
}

async function setWardrobeData(input: {
  operation: z.infer<typeof operationSchema>;
  id?: string;
  data?: Record<string, unknown>;
}, auth: ReturnType<typeof requireAuthenticated>) {
  requireId(input.operation, input.id);
  const clean = normalizeItem(stripOwnerFields(objectData(input.data)));

  if (input.operation === "create") {
    const { data, error } = await auth.supabase
      .from("wardrobe_items")
      .insert({ ...clean, user_id: auth.userId })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return data;
  }

  if (input.operation === "update") {
    const { data, error } = await auth.supabase
      .from("wardrobe_items")
      .update(withUpdatedAt(clean, nowIso()))
      .eq("id", input.id!)
      .eq("user_id", auth.userId)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return data;
  }

  const { error } = await auth.supabase.from("wardrobe_items").delete().eq("id", input.id!).eq("user_id", auth.userId);
  if (error) throw new Error(error.message);
  return { deleted: true, resource: "items", id: input.id };
}

export const getWardrobe = defineTool({
  name: "get_wardrobe",
  title: "Get Wardrobe Data",
  description: "Read Wardrobe items for the signed-in user.",
  inputSchema: {
    id: uuidSchema.optional().describe("Optional item id to narrow the result."),
    status: wardrobeStatusSchema.optional(),
    category: wardrobeCategorySchema.optional(),
    limit: z.number().int().min(1).max(500).optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: (input, ctx) => toMcpResult(getWardrobeData(input, requireAuthenticated(ctx))),
});

export const setWardrobe = defineTool({
  name: "set_wardrobe",
  title: "Set Wardrobe Data",
  description: "Create, update, or delete Wardrobe items for the signed-in user.",
  inputSchema: {
    operation: operationSchema,
    id: uuidSchema.optional().describe("Item id required for update and delete."),
    data: jsonObjectSchema.optional().describe("Item fields for create or update. Owner fields are ignored."),
  },
  annotations: { readOnlyHint: false, idempotentHint: false, openWorldHint: false },
  handler: (input, ctx) => toMcpResult(setWardrobeData(input, requireAuthenticated(ctx))),
});
