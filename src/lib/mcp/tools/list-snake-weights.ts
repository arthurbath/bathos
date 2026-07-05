import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, toError, toJson } from "../supabase";

export default defineTool({
  name: "list_snake_weights",
  title: "List snake weight records",
  description: "List Snake weight records for the signed-in user.",
  inputSchema: {
    limit: z.number().int().min(1).max(500).optional().describe("Max rows (default 100)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    if (!ctx.isAuthenticated()) return toError("Not authenticated");
    const { data, error } = await supabaseForUser(ctx)
      .from("snake_weight_records")
      .select("*")
      .order("recorded_at", { ascending: false })
      .limit(limit ?? 100);
    if (error) return toError(error.message);
    return toJson(data);
  },
});
