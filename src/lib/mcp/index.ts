import { auth, defineMcp } from "@lovable.dev/mcp-js";
import whoami from "./tools/whoami";
import listGarageVehicles from "./tools/list-garage-vehicles";
import listGarageServices from "./tools/list-garage-services";
import listWardrobeItems from "./tools/list-wardrobe-items";
import listSnakeWeights from "./tools/list-snake-weights";
import listBudgetExpenses from "./tools/list-budget-expenses";

// Direct Supabase host for OAuth issuer (must not be a proxy URL).
// VITE_SUPABASE_PROJECT_ID is inlined by Vite at build time, keeping this
// module import-safe (no runtime env reads at top level).
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "bathos-mcp",
  title: "BathOS",
  version: "0.1.0",
  instructions:
    "Read-only tools for the signed-in BathOS user across the Budget, Garage, Wardrobe, and Snake modules. Use `whoami` to verify connectivity.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    whoami,
    listGarageVehicles,
    listGarageServices,
    listWardrobeItems,
    listSnakeWeights,
    listBudgetExpenses,
  ],
});
