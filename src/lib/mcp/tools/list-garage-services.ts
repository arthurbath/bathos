import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, toError, toJson } from "../supabase";

export default defineTool({
  name: "list_garage_services",
  title: "List garage services",
  description: "List Garage services, optionally filtered to one vehicle.",
  inputSchema: {
    vehicle_id: z.string().uuid().optional().describe("Optional vehicle id to filter by."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ vehicle_id }, ctx) => {
    if (!ctx.isAuthenticated()) return toError("Not authenticated");
    let query = supabaseForUser(ctx).from("garage_services").select("*");
    if (vehicle_id) query = query.eq("vehicle_id", vehicle_id);
    const { data, error } = await query;
    if (error) return toError(error.message);
    return toJson(data);
  },
});
