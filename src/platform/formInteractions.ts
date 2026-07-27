import { isMacLikePlatform } from "@/lib/platform";

export const BATHOS_FORM_SCOPE_ATTRIBUTE = "data-bathos-form-scope";
export const BATHOS_FORM_SUBMIT_ATTRIBUTE = "data-bathos-form-submit";
export const BATHOS_FORM_CANCEL_ATTRIBUTE = "data-bathos-form-cancel";
export const BATHOS_RETURN_SUBMITS_ATTRIBUTE = "data-bathos-return-submits";
export const BATHOS_FIELD_RETURN_OWNED_ATTRIBUTE = "data-bathos-field-return-owned";

const EXPLICIT_SCOPE_SELECTOR = [
  `[${BATHOS_FORM_SCOPE_ATTRIBUTE}="true"]`,
  '[data-command-enter-scope="true"]',
  '[role="dialog"]',
  '[role="alertdialog"]',
].join(", ");

const SUBMIT_ACTION_SELECTOR = [
  `[${BATHOS_FORM_SUBMIT_ATTRIBUTE}="true"]`,
  '[data-command-enter-confirm="true"]',
  '[data-dialog-confirm="true"]',
  '[data-alert-dialog-action="true"]',
].join(", ");

const CANCEL_ACTION_SELECTOR = [
  `[${BATHOS_FORM_CANCEL_ATTRIBUTE}="true"]`,
  '[data-modal-shortcut-close="true"]',
  '[data-modal-close="true"]',
  '[data-alert-dialog-cancel="true"]',
].join(", ");

const SINGLE_LINE_TEXT_INPUT_TYPES = new Set([
  "",
  "date",
  "datetime-local",
  "email",
  "month",
  "number",
  "password",
  "search",
  "tel",
  "text",
  "time",
  "url",
  "week",
]);

const FORM_FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([type="hidden"]):not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

export type BathosFormCommand = "submit" | "cancel";

export function getBathosFormCommand(
  event: Pick<KeyboardEvent, "key" | "metaKey" | "ctrlKey" | "altKey" | "shiftKey">,
  macLikePlatform: boolean,
): BathosFormCommand | null {
  if (event.altKey) return null;

  if (macLikePlatform) {
    if (!event.metaKey || event.ctrlKey || event.shiftKey) return null;
    if (event.key === "Enter") return "submit";
    if (event.key === "Escape") return "cancel";
    return null;
  }

  if (!event.ctrlKey || event.metaKey) return null;
  if (event.key === "Enter" && !event.shiftKey) return "submit";
  if (event.key.toLowerCase() === "x" && event.shiftKey) return "cancel";
  return null;
}

export function isSingleLineTextEntry(target: EventTarget | null): target is HTMLInputElement {
  return target instanceof HTMLInputElement
    && SINGLE_LINE_TEXT_INPUT_TYPES.has(target.type.toLowerCase());
}

export function isActionableFormElement(element: HTMLElement | null): element is HTMLElement {
  if (!element || element.hidden) return false;
  if ("disabled" in element && typeof element.disabled === "boolean" && element.disabled) return false;
  if (element.getAttribute("aria-disabled") === "true") return false;
  return true;
}

export function getNearestExplicitFormScope(target: HTMLElement): HTMLElement | null {
  const directScope = target.closest<HTMLElement>(EXPLICIT_SCOPE_SELECTOR);
  if (directScope) return directScope;
  const portalOwner = getPortalOwnerTrigger(target);
  return portalOwner?.closest<HTMLElement>(EXPLICIT_SCOPE_SELECTOR) ?? null;
}

export function getNearestFormInteractionScope(target: HTMLElement): HTMLElement | null {
  const explicitScope = getNearestExplicitFormScope(target);
  if (explicitScope) return explicitScope;
  const directForm = target.closest<HTMLFormElement>("form");
  if (directForm) return directForm;
  return getPortalOwnerTrigger(target)?.closest<HTMLFormElement>("form") ?? null;
}

function getOwnedForm(target: HTMLElement, scope: HTMLElement | null): HTMLFormElement | null {
  const directForm = target.closest<HTMLFormElement>("form");
  if (directForm && (!scope || scope.contains(directForm))) return directForm;
  if (scope instanceof HTMLFormElement) return scope;
  return scope?.querySelector<HTMLFormElement>("form") ?? null;
}

function getPortalOwnerTrigger(target: HTMLElement): HTMLElement | null {
  let candidate: HTMLElement | null = target;
  while (candidate && candidate !== document.body) {
    if (candidate.id) {
      const escapedId = candidate.id
        .replaceAll("\\", "\\\\")
        .replaceAll('"', '\\"');
      const trigger = document.querySelector<HTMLElement>(
        `[aria-controls="${escapedId}"]`,
      );
      if (trigger) return trigger;
    }
    candidate = candidate.parentElement;
  }
  return null;
}

function getAction(scope: HTMLElement | null, selector: string): HTMLElement | null {
  if (!scope) return null;
  const action = scope.matches(selector)
    ? scope
    : scope.querySelector<HTMLElement>(selector);
  return isActionableFormElement(action) ? action : null;
}

export function submitNearestFormScope(target: HTMLElement): boolean {
  const scope = getNearestFormInteractionScope(target);
  const form = getOwnedForm(target, scope);
  if (form) {
    form.requestSubmit();
    return true;
  }

  const submitAction = getAction(scope, SUBMIT_ACTION_SELECTOR);
  if (!submitAction) return false;
  submitAction.click();
  return true;
}

export function cancelNearestFormScope(target: HTMLElement): boolean {
  const explicitScope = getNearestExplicitFormScope(target);
  const fallbackForm = target.closest<HTMLFormElement>("form");
  const scope = explicitScope ?? fallbackForm;
  const cancelAction = getAction(scope, CANCEL_ACTION_SELECTOR);
  if (!cancelAction) return false;
  cancelAction.click();
  return true;
}

export function scopeAllowsReturnSubmit(target: HTMLElement): boolean {
  const form = target.closest<HTMLFormElement>("form");
  if (form?.getAttribute(BATHOS_RETURN_SUBMITS_ATTRIBUTE) === "false") return false;
  if (form) return true;
  return getNearestExplicitFormScope(target)
    ?.getAttribute(BATHOS_RETURN_SUBMITS_ATTRIBUTE) !== "false";
}

export function fieldOwnsReturn(target: HTMLElement): boolean {
  return target.closest<HTMLElement>(`[${BATHOS_FIELD_RETURN_OWNED_ATTRIBUTE}="true"]`) !== null;
}

function isAvailableFormControl(element: HTMLElement): boolean {
  if (element.hidden || element.getAttribute("aria-hidden") === "true") return false;
  if (element.closest("[inert]")) return false;
  if (element.closest("[data-radix-popper-content-wrapper]")) return false;
  const style = window.getComputedStyle(element);
  return style.display !== "none" && style.visibility !== "hidden";
}

export function focusAdjacentFormControl(
  trigger: HTMLElement,
  backwards = false,
): boolean {
  const explicitScope = getNearestExplicitFormScope(trigger);
  const nativeForm = trigger.closest<HTMLFormElement>("form");
  const root: ParentNode = explicitScope ?? nativeForm ?? document;
  const controls = Array.from(root.querySelectorAll<HTMLElement>(FORM_FOCUSABLE_SELECTOR))
    .filter(isAvailableFormControl);
  const currentIndex = controls.indexOf(trigger);
  if (currentIndex < 0) return false;

  let nextIndex = backwards ? currentIndex - 1 : currentIndex + 1;
  if (explicitScope) {
    if (nextIndex < 0) nextIndex = controls.length - 1;
    if (nextIndex >= controls.length) nextIndex = 0;
  }
  const target = controls[nextIndex];
  if (!target) return false;
  target.focus();
  return document.activeElement === target;
}

export function currentPlatformIsMacLike(): boolean {
  return isMacLikePlatform(globalThis.navigator?.platform ?? "");
}
