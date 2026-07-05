import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, toError, toJson } from "../supabase";

export default defineTool({
  name: "list_budget_expenses",
  title: "List budget expenses",
  description: "List Budget expenses for the signed-in user's household.",
  inputSchema: {
    limit: z.number().int().min(1).max(500).optional().describe("Max rows (default 200)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    if (!ctx.isAuthenticated()) return toError("Not authenticated");
    const { data, error } = await supabaseForUser(ctx)
      .from("budget_expenses")
      .select("*")
      .limit(limit ?? 200);
    if (error) return toError(error.message);
    return toJson(data);
  },
});
