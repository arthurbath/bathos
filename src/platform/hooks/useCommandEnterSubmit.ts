import { useEffect } from "react";

import {
  currentPlatformIsMacLike,
  fieldOwnsReturn,
  getBathosFormCommand,
  getNearestFormInteractionScope,
  isSingleLineTextEntry,
  scopeAllowsReturnSubmit,
  cancelNearestFormScope,
  submitNearestFormScope,
} from "@/platform/formInteractions";

export function useBathosFormInteractions() {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.isComposing) return;

      const target = event.target instanceof HTMLElement ? event.target : null;
      if (!target) return;

      const unmodified = !event.metaKey && !event.ctrlKey && !event.altKey && !event.shiftKey;
      if (unmodified && event.key === " ") {
        const link = target.closest<HTMLAnchorElement>("a[href]");
        if (link) {
          event.preventDefault();
          event.stopImmediatePropagation();
          link.click();
          return;
        }
      }

      if (
        unmodified
        && (event.key === "Enter" || event.key === "Delete" || event.key === "Backspace")
        && !target.closest("[data-row][data-col]")
      ) {
        const binaryControl = target.closest<HTMLElement>(
          'input[type="checkbox"], [role="checkbox"], [role="switch"]',
        );
        if (binaryControl && isActionableBinaryControl(binaryControl)) {
          event.preventDefault();
          event.stopImmediatePropagation();
          if (event.key === "Enter" || binaryControlIsChecked(binaryControl)) {
            binaryControl.click();
          }
          return;
        }
      }

      const command = getBathosFormCommand(event, currentPlatformIsMacLike());
      if (command) {
        const handled = command === "submit"
          ? submitNearestFormScope(target)
          : cancelNearestFormScope(target);
        if (!handled) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }

      if (
        event.key !== "Enter"
        || event.metaKey
        || event.ctrlKey
        || event.altKey
        || event.shiftKey
        || !isSingleLineTextEntry(target)
        || fieldOwnsReturn(target)
      ) return;

      event.preventDefault();
      if (
        scopeAllowsReturnSubmit(target)
        && getNearestFormInteractionScope(target)
      ) {
        submitNearestFormScope(target);
      }
    };

    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, []);
}

function isActionableBinaryControl(control: HTMLElement): boolean {
  return !(
    ("disabled" in control && control.disabled === true)
    || control.getAttribute("aria-disabled") === "true"
  );
}

function binaryControlIsChecked(control: HTMLElement): boolean {
  if (control instanceof HTMLInputElement) return control.checked;
  const checked = control.getAttribute("aria-checked");
  return checked === "true" || checked === "mixed";
}

export const useCommandEnterSubmit = useBathosFormInteractions;
