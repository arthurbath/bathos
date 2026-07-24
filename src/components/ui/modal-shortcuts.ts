import type * as React from "react";
import type * as DialogPrimitive from "@radix-ui/react-dialog";
import type * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";
import { isMobileViewport } from "@/components/ui/modal-viewport";

const MODAL_FOCUSABLE_SELECTOR = [
  'input:not([type="hidden"]):not([disabled])',
  'textarea:not([disabled])',
  'select:not([disabled])',
  'button:not([disabled])',
  '[role="combobox"]:not([aria-disabled="true"])',
  '[role="checkbox"]:not([aria-disabled="true"])',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
].join(", ");

const MODAL_FORM_CONTROL_SELECTOR = [
  '[autofocus]:not([disabled]):not([aria-disabled="true"]):not([hidden])',
  'input:not([type="hidden"]):not([disabled])',
  'textarea:not([disabled])',
  'select:not([disabled])',
  '[role="combobox"]:not([aria-disabled="true"])',
  '[role="checkbox"]:not([aria-disabled="true"])',
  '[contenteditable="true"]',
].join(", ");

const isFocusableVisible = (element: HTMLElement) => {
  if (element.hidden) return false;
  const style = window.getComputedStyle(element);
  if (style.display === "none" || style.visibility === "hidden") return false;
  return true;
};

export const getModalFocusableElements = (container: HTMLElement) =>
  Array.from(container.querySelectorAll<HTMLElement>(MODAL_FOCUSABLE_SELECTOR)).filter((element) => {
    if (element.dataset.modalClose === "true") return false;
    if (element.dataset.modalShortcutClose === "true") return false;
    if (element.getAttribute("aria-disabled") === "true") return false;
    return isFocusableVisible(element);
  });

export const getModalOpenAutoFocusHandler = (
  onOpenAutoFocus?: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>["onOpenAutoFocus"]
    | React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Content>["onOpenAutoFocus"],
) => {
  return (event: Event & { currentTarget: EventTarget & HTMLElement }) => {
    onOpenAutoFocus?.(event);
    if (event.defaultPrevented) return;

    const content = event.currentTarget;
    event.preventDefault();
    if (isMobileViewport()) {
      content.focus();
      return;
    }

    const focusTarget =
      content.querySelector<HTMLElement>(MODAL_FORM_CONTROL_SELECTOR) ??
      content.querySelector<HTMLElement>('[data-bathos-form-submit="true"], [data-dialog-confirm="true"], [data-alert-dialog-action="true"]') ??
      getModalFocusableElements(content)[0] ??
      content;
    focusTarget.focus();
  };
};

export const getModalKeyDownHandler = (
  onKeyDown?: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>["onKeyDown"]
    | React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Content>["onKeyDown"],
) => {
  return (event: React.KeyboardEvent<HTMLElement>) => {
    (onKeyDown as ((event: React.KeyboardEvent<HTMLElement>) => void) | undefined)?.(event);
    if (event.defaultPrevented) return;

    const content = event.currentTarget;

    if (event.key !== "Tab") return;

    const focusables = getModalFocusableElements(content);
    if (focusables.length === 0) return;

    const active = document.activeElement;
    if (!(active instanceof HTMLElement)) return;

    let activeIndex = focusables.indexOf(active);
    if (activeIndex < 0) {
      activeIndex = focusables.findIndex((element) => element.contains(active));
    }
    if (activeIndex < 0) {
      event.preventDefault();
      const fallbackIndex = event.shiftKey ? focusables.length - 1 : 0;
      focusables[fallbackIndex]?.focus();
      return;
    }

    event.preventDefault();
    const nextIndex = event.shiftKey
      ? (activeIndex - 1 + focusables.length) % focusables.length
      : (activeIndex + 1) % focusables.length;

    focusables[nextIndex]?.focus();
  };
};

export const getModalEscapeKeyDownHandler = (
  onEscapeKeyDown?: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>["onEscapeKeyDown"]
    | React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Content>["onEscapeKeyDown"],
) => {
  return (event: KeyboardEvent) => {
    onEscapeKeyDown?.(event);
    if (!event.defaultPrevented) {
      event.preventDefault();
    }
  };
};
