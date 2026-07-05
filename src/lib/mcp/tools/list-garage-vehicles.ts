import { defineTool } from "@lovable.dev/mcp-js";
import { supabaseForUser, toError, toJson } from "../supabase";

export default defineTool({
  name: "list_garage_vehicles",
  title: "List garage vehicles",
  description: "List the signed-in user's Garage vehicles.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) return toError("Not authenticated");
    const { data, error } = await supabaseForUser(ctx)
      .from("garage_vehicles")
      .select("*")
      .order("name", { ascending: true });
    if (error) return toError(error.message);
    return toJson(data);
  },
});
