import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, toError, toJson } from "../supabase";

export default defineTool({
  name: "list_wardrobe_items",
  title: "List wardrobe items",
  description: "List the signed-in user's Wardrobe items, optionally filtered by status.",
  inputSchema: {
    status: z.string().optional().describe("Optional status filter (e.g. 'owned', 'wishlist')."),
    limit: z.number().int().min(1).max(500).optional().describe("Max rows to return (default 100)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ status, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return toError("Not authenticated");
    let query = supabaseForUser(ctx)
      .from("wardrobe_items")
      .select("*")
      .limit(limit ?? 100);
    if (status) query = query.eq("status", status);
    const { data, error } = await query;
    if (error) return toError(error.message);
    return toJson(data);
  },
});
