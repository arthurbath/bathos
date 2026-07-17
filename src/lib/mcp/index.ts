import { auth, defineMcp } from "./mcp-core";
import whoami from "./tools/whoami";
import { getGarage, setGarage } from "./tools/garage-actions";
import { getSnake, setSnake } from "./tools/snake-actions";
import { getBudget, setBudget } from "./tools/budget-actions";
import { getWardrobe, setWardrobe } from "./tools/wardrobe-actions";

// Direct Supabase host for OAuth issuer (must not be a proxy URL).
// VITE_SUPABASE_PROJECT_ID is inlined by Vite at build time, keeping this
// module import-safe (no runtime env reads at top level).
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "bathos-mcp",
  title: "BathOS",
  version: "0.1.0",
  instructions:
    "Authenticated tools for the signed-in BathOS user across Budget, Garage, Snake, and Wardrobe. Use `whoami` to verify connectivity. Read with get_* tools. Mutate only when the user clearly asks, using set_* tools scoped by the signed-in user or accessible household. Receipt files, household lifecycle actions, and restore execution are out of scope.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    whoami,
    getGarage,
    setGarage,
    getSnake,
    setSnake,
    getBudget,
    setBudget,
    getWardrobe,
    setWardrobe,
  ],
});
