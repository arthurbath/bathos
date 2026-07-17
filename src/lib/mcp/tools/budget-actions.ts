import { defineTool, z } from "../mcp-core";
import { requireAuthenticated, resolveBudgetHousehold, toMcpResult } from "../supabase";
import { jsonObjectSchema, objectData, operationSchema, requireId, stripOwnerFields, trimString, uuidSchema } from "../resource-utils";

const budgetResourceSchema = z.enum([
  "summary",
  "household_settings",
  "expenses",
  "incomes",
  "budgets",
  "categories",
  "payment_methods",
]);

function tableForResource(resource: z.infer<typeof budgetResourceSchema>) {
  switch (resource) {
    case "expenses":
      return "budget_expenses" as const;
    case "incomes":
      return "budget_income_streams" as const;
    case "budgets":
      return "budget_budgets" as const;
    case "categories":
      return "budget_categories" as const;
    case "payment_methods":
      return "budget_linked_accounts" as const;
    default:
      throw new Error(`${resource} is not a table-backed Budget resource.`);
  }
}

function normalizeNamed(data: Record<string, unknown>) {
  return {
    ...data,
    name: typeof data.name === "string" ? data.name.trim() : data.name,
  };
}

function householdSettingsData(data: Record<string, unknown>) {
  const allowed = [
    "name",
    "partner_x_name",
    "partner_y_name",
    "wage_gap_adjustment_enabled",
    "partner_x_wage_cents_per_dollar",
    "partner_y_wage_cents_per_dollar",
    "partner_x_color",
    "partner_y_color",
  ];
  return Object.fromEntries(
    Object.entries(data)
      .filter(([key]) => allowed.includes(key))
      .map(([key, value]) => [key, typeof value === "string" ? value.trim() : value]),
  );
}

async function getBudgetData(input: {
  resource: z.infer<typeof budgetResourceSchema>;
  household_id?: string;
  id?: string;
  limit?: number;
}, auth: ReturnType<typeof requireAuthenticated>) {
  const householdId = await resolveBudgetHousehold(auth, input.household_id);

  if (input.resource === "summary") {
    const [household, expenses, incomes, budgets, categories, paymentMethods] = await Promise.all([
      auth.supabase.from("budget_households").select("*").eq("id", householdId).single(),
      auth.supabase.from("budget_expenses").select("*").eq("household_id", householdId).order("created_at").limit(input.limit ?? 500),
      auth.supabase.from("budget_income_streams").select("*").eq("household_id", householdId).order("created_at").limit(input.limit ?? 500),
      auth.supabase.from("budget_budgets").select("*").eq("household_id", householdId).order("name").limit(input.limit ?? 500),
      auth.supabase.from("budget_categories").select("*").eq("household_id", householdId).order("name").limit(input.limit ?? 500),
      auth.supabase.from("budget_linked_accounts").select("*").eq("household_id", householdId).order("name").limit(input.limit ?? 500),
    ]);
    for (const result of [household, expenses, incomes, budgets, categories, paymentMethods]) {
      if (result.error) throw new Error(result.error.message);
    }
    return {
      household: household.data,
      expenses: expenses.data,
      incomes: incomes.data,
      budgets: budgets.data,
      categories: categories.data,
      payment_methods: paymentMethods.data,
    };
  }

  if (input.resource === "household_settings") {
    const { data, error } = await auth.supabase.from("budget_households").select("*").eq("id", householdId).single();
    if (error) throw new Error(error.message);
    return data;
  }

  const table = tableForResource(input.resource);
  let query = auth.supabase.from(table).select("*").eq("household_id", householdId);
  if (input.id) query = query.eq("id", input.id);
  const { data, error } = await query.limit(input.limit ?? 500);
  if (error) throw new Error(error.message);
  return data;
}

async function setBudgetData(input: {
  resource: z.infer<typeof budgetResourceSchema>;
  operation: z.infer<typeof operationSchema>;
  household_id?: string;
  id?: string;
  data?: Record<string, unknown>;
}, auth: ReturnType<typeof requireAuthenticated>) {
  if (input.resource === "summary") throw new Error("summary is read-only.");
  const householdId = await resolveBudgetHousehold(auth, input.household_id);
  const clean = normalizeNamed(stripOwnerFields(objectData(input.data)));

  if (input.resource === "household_settings") {
    if (input.operation !== "update") throw new Error("household_settings only supports update.");
    const update = householdSettingsData(clean);
    if (Object.keys(update).length === 0) throw new Error("No supported household settings supplied.");
    const { data, error } = await auth.supabase
      .from("budget_households")
      .update(update)
      .eq("id", householdId)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return data;
  }

  requireId(input.operation, input.id);
  const table = tableForResource(input.resource);

  if (input.operation === "create") {
    const { data, error } = await auth.supabase
      .from(table)
      .insert({ ...clean, household_id: householdId })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return data;
  }

  if (input.operation === "update") {
    const { data, error } = await auth.supabase
      .from(table)
      .update(clean)
      .eq("id", input.id!)
      .eq("household_id", householdId)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return data;
  }

  const { error } = await auth.supabase
    .from(table)
    .delete()
    .eq("id", input.id!)
    .eq("household_id", householdId);
  if (error) throw new Error(error.message);
  return { deleted: true, resource: input.resource, id: input.id };
}

export const getBudget = defineTool({
  name: "get_budget",
  title: "Get Budget Data",
  description: "Read Budget household summary, settings, expenses, incomes, budgets, categories, or payment methods.",
  inputSchema: {
    resource: budgetResourceSchema,
    household_id: uuidSchema.optional().describe("Optional accessible Budget household id."),
    id: uuidSchema.optional().describe("Optional record id to narrow the result."),
    limit: z.number().int().min(1).max(500).optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: (input, ctx) => toMcpResult(getBudgetData(input, requireAuthenticated(ctx))),
});

export const setBudget = defineTool({
  name: "set_budget",
  title: "Set Budget Data",
  description: "Create, update, or delete Budget records, or update Budget household partner settings.",
  inputSchema: {
    resource: z.enum(["household_settings", "expenses", "incomes", "budgets", "categories", "payment_methods"]),
    operation: operationSchema,
    household_id: uuidSchema.optional().describe("Optional accessible Budget household id."),
    id: uuidSchema.optional().describe("Record id required for update and delete."),
    data: jsonObjectSchema.optional().describe("Record fields for create or update. Owner fields are ignored."),
  },
  annotations: { readOnlyHint: false, idempotentHint: false, openWorldHint: false },
  handler: (input, ctx) => toMcpResult(setBudgetData(input, requireAuthenticated(ctx))),
});
