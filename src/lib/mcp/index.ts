import { auth, defineMcp } from "./mcp-core";
import whoami from "./tools/whoami";
import { getGarage, setGarage } from "./tools/garage-actions";
import { getSnake, setSnake } from "./tools/snake-actions";
import { getBudget, setBudget } from "./tools/budget-actions";
import { getWardrobe, setWardrobe } from "./tools/wardrobe-actions";
import { getTaskHierarchy, getTaskRecord, getTaskView } from "./tools/tasks-read";
import { createTask } from "./tools/tasks-create";
import {
  beginMailRetirement,
  createMailTask,
  resolveMailRetirement,
} from "./tools/tasks-mail";
import { moveTask, scheduleTask, transitionTask, updateTask } from "./tools/tasks-mutate";
import { getTaskTemplates, instantiateTaskTemplate } from "./tools/tasks-templates";
import {
  evaluateTaskRecurrence,
  getTaskRecurrences,
  saveTaskRecurrence,
  setTaskRecurrenceStatus,
} from "./tools/tasks-recurrence";
import {
  cancelTaskReminder,
  getTaskReminders,
  saveTaskReminder,
} from "./tools/tasks-reminders";

// Direct Supabase host for OAuth issuer (must not be a proxy URL).
// VITE_SUPABASE_PROJECT_ID is inlined by Vite at build time, keeping this
// module import-safe (no runtime env reads at top level).
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "bathos-mcp",
  title: "BathOS",
  version: "0.1.0",
  instructions:
    "Authenticated tools for the signed-in BathOS user across Budget, Garage, Snake, Tasks, and Wardrobe. Use `whoami` to verify connectivity. Read with get_* tools. Tasks expose owner-scoped hierarchy, record, planning views, native templates, recurrence definitions, and resolved reminders plus guarded create, update, move, schedule, template-instantiation, recurrence, reminder, and lifecycle or recovery mutations. Use task mutations only when the user clearly asks, read the current revision first, and never reuse a mutation UUID for a different request. Recurrence rules use explicit calendar dates. Reminders use explicit local date, wall-clock time, IANA time zone, and daylight-saving ambiguity choice. Neither uses tags. Task deletion is recoverable; permanent deletion is unavailable. Mutate other modules only when the user clearly asks, using set_* tools scoped by the signed-in user or accessible household. Receipt files, household lifecycle actions, and restore execution are out of scope.",
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
    getTaskHierarchy,
    getTaskRecord,
    getTaskView,
    getTaskTemplates,
    getTaskRecurrences,
    getTaskReminders,
    createTask,
    createMailTask,
    beginMailRetirement,
    resolveMailRetirement,
    updateTask,
    moveTask,
    scheduleTask,
    transitionTask,
    instantiateTaskTemplate,
    saveTaskRecurrence,
    setTaskRecurrenceStatus,
    evaluateTaskRecurrence,
    saveTaskReminder,
    cancelTaskReminder,
  ],
});
