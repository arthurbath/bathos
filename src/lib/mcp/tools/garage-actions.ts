import { defineTool, z } from "../mcp-core";
import { nowIso, requireAuthenticated, toMcpResult } from "../supabase";
import { jsonObjectSchema, objectData, operationSchema, requireId, stripOwnerFields, trimString, uuidSchema, withUpdatedAt } from "../resource-utils";

const garageResourceSchema = z.enum(["vehicles", "services", "servicings"]);

const serviceOutcomeSchema = z.object({
  service_id: uuidSchema,
  status: z.enum(["performed", "not_needed_yet", "declined"]).default("performed"),
});

function deriveCadenceType(data: Record<string, unknown>) {
  const everyMiles = Number(data.every_miles ?? 0);
  const everyMonths = Number(data.every_months ?? 0);
  return everyMiles > 0 || everyMonths > 0 ? "recurring" : "no_interval";
}

async function saveServicingOutcomes(args: {
  auth: ReturnType<typeof requireAuthenticated>;
  servicingId: string;
  vehicleId: string;
  outcomes: z.infer<typeof serviceOutcomeSchema>[];
}) {
  const { error: deleteError } = await args.auth.supabase
    .from("garage_servicing_services")
    .delete()
    .eq("user_id", args.auth.userId)
    .eq("vehicle_id", args.vehicleId)
    .eq("servicing_id", args.servicingId);
  if (deleteError) throw new Error(deleteError.message);

  const deduped = Array.from(new Map(args.outcomes.map((outcome) => [outcome.service_id, outcome])).values());
  if (deduped.length === 0) return;

  const { error } = await args.auth.supabase.from("garage_servicing_services").insert(
    deduped.map((outcome) => ({
      user_id: args.auth.userId,
      vehicle_id: args.vehicleId,
      servicing_id: args.servicingId,
      service_id: outcome.service_id,
      status: outcome.status,
    })),
  );
  if (error) throw new Error(error.message);
}

async function getGarageData(input: {
  resource: z.infer<typeof garageResourceSchema>;
  vehicle_id?: string;
  id?: string;
  limit?: number;
}, auth: ReturnType<typeof requireAuthenticated>) {
  if (input.resource === "vehicles") {
    let query = auth.supabase.from("garage_vehicles").select("*").eq("user_id", auth.userId);
    if (input.id) query = query.eq("id", input.id);
    const { data, error } = await query.order("created_at", { ascending: true }).limit(input.limit ?? 500);
    if (error) throw new Error(error.message);
    return data;
  }

  if (!input.vehicle_id) throw new Error(`${input.resource} requires vehicle_id.`);

  if (input.resource === "services") {
    let query = auth.supabase
      .from("garage_services")
      .select("*")
      .eq("user_id", auth.userId)
      .eq("vehicle_id", input.vehicle_id);
    if (input.id) query = query.eq("id", input.id);
    const { data, error } = await query
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true })
      .limit(input.limit ?? 500);
    if (error) throw new Error(error.message);
    return data;
  }

  let query = auth.supabase
    .from("garage_servicings")
    .select("*, outcomes:garage_servicing_services(*), receipts:garage_servicing_receipts(*)")
    .eq("user_id", auth.userId)
    .eq("vehicle_id", input.vehicle_id);
  if (input.id) query = query.eq("id", input.id);
  const { data, error } = await query
    .order("service_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(input.limit ?? 500);
  if (error) throw new Error(error.message);
  return data;
}

async function setGarageData(input: {
  resource: z.infer<typeof garageResourceSchema>;
  operation: z.infer<typeof operationSchema>;
  id?: string;
  vehicle_id?: string;
  data?: Record<string, unknown>;
  outcomes?: z.infer<typeof serviceOutcomeSchema>[];
}, auth: ReturnType<typeof requireAuthenticated>) {
  requireId(input.operation, input.id);
  const raw = objectData(input.data);
  const clean = stripOwnerFields(raw);

  if (input.resource === "vehicles") {
    if (input.operation === "create") {
      const insert = {
        ...clean,
        user_id: auth.userId,
        name: trimString(clean.name),
      };
      const { data, error } = await auth.supabase.from("garage_vehicles").insert(insert).select("*").single();
      if (error) throw new Error(error.message);
      return data;
    }

    if (input.operation === "update") {
      const { data, error } = await auth.supabase
        .from("garage_vehicles")
        .update(withUpdatedAt({ ...clean, name: trimString(clean.name) }, nowIso()))
        .eq("id", input.id!)
        .eq("user_id", auth.userId)
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      return data;
    }

    const { error } = await auth.supabase.from("garage_vehicles").delete().eq("id", input.id!).eq("user_id", auth.userId);
    if (error) throw new Error(error.message);
    return { deleted: true, resource: input.resource, id: input.id };
  }

  const vehicleId = input.vehicle_id ?? (typeof raw.vehicle_id === "string" ? raw.vehicle_id : undefined);
  if (!vehicleId) throw new Error(`${input.resource} requires vehicle_id.`);

  if (input.resource === "services") {
    if (input.operation === "create") {
      const insert = {
        ...clean,
        user_id: auth.userId,
        vehicle_id: vehicleId,
        name: trimString(clean.name),
        cadence_type: clean.cadence_type ?? deriveCadenceType(clean),
      };
      const { data, error } = await auth.supabase.from("garage_services").insert(insert).select("*").single();
      if (error) throw new Error(error.message);
      return data;
    }

    if (input.operation === "update") {
      const update = {
        ...clean,
        name: trimString(clean.name),
        cadence_type: clean.cadence_type ?? deriveCadenceType(clean),
      };
      const { data, error } = await auth.supabase
        .from("garage_services")
        .update(withUpdatedAt(update, nowIso()))
        .eq("id", input.id!)
        .eq("user_id", auth.userId)
        .eq("vehicle_id", vehicleId)
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      return data;
    }

    const { error } = await auth.supabase
      .from("garage_services")
      .delete()
      .eq("id", input.id!)
      .eq("user_id", auth.userId)
      .eq("vehicle_id", vehicleId);
    if (error) throw new Error(error.message);
    return { deleted: true, resource: input.resource, id: input.id };
  }

  if (input.operation === "create") {
    const servicingId = typeof raw.id === "string" ? raw.id : crypto.randomUUID();
    const { error } = await auth.supabase.from("garage_servicings").insert({
      ...clean,
      id: servicingId,
      user_id: auth.userId,
      vehicle_id: vehicleId,
    });
    if (error) throw new Error(error.message);
    await saveServicingOutcomes({ auth, servicingId, vehicleId, outcomes: input.outcomes ?? [] });
    return (await getGarageData({ resource: "servicings", vehicle_id: vehicleId, id: servicingId }, auth))[0] ?? { id: servicingId };
  }

  if (input.operation === "update") {
    const { error } = await auth.supabase
      .from("garage_servicings")
      .update(withUpdatedAt(clean, nowIso()))
      .eq("id", input.id!)
      .eq("user_id", auth.userId)
      .eq("vehicle_id", vehicleId);
    if (error) throw new Error(error.message);
    if (input.outcomes) {
      await saveServicingOutcomes({ auth, servicingId: input.id!, vehicleId, outcomes: input.outcomes });
    }
    return (await getGarageData({ resource: "servicings", vehicle_id: vehicleId, id: input.id }, auth))[0] ?? { id: input.id };
  }

  const { error } = await auth.supabase
    .from("garage_servicings")
    .delete()
    .eq("id", input.id!)
    .eq("user_id", auth.userId)
    .eq("vehicle_id", vehicleId);
  if (error) throw new Error(error.message);
  return { deleted: true, resource: input.resource, id: input.id };
}

export const getGarage = defineTool({
  name: "get_garage",
  title: "Get Garage Data",
  description: "Read Garage vehicles, services, or servicings for the signed-in user.",
  inputSchema: {
    resource: garageResourceSchema.describe("Garage resource to read: vehicles, services, or servicings."),
    vehicle_id: uuidSchema.optional().describe("Vehicle id required for services and servicings."),
    id: uuidSchema.optional().describe("Optional record id to narrow the result."),
    limit: z.number().int().min(1).max(500).optional().describe("Max rows to return."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: (input, ctx) => toMcpResult(getGarageData(input, requireAuthenticated(ctx))),
});

export const setGarage = defineTool({
  name: "set_garage",
  title: "Set Garage Data",
  description: "Create, update, or delete Garage vehicles, services, or servicings for the signed-in user.",
  inputSchema: {
    resource: garageResourceSchema,
    operation: operationSchema,
    id: uuidSchema.optional().describe("Record id required for update and delete."),
    vehicle_id: uuidSchema.optional().describe("Vehicle id required for service and servicing mutations."),
    data: jsonObjectSchema.optional().describe("Record fields for create or update. Owner fields are ignored."),
    outcomes: z.array(serviceOutcomeSchema).optional().describe("Optional servicing service outcomes for servicings."),
  },
  annotations: { readOnlyHint: false, idempotentHint: false, openWorldHint: false },
  handler: (input, ctx) => toMcpResult(setGarageData(input, requireAuthenticated(ctx))),
});
