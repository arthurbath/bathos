import type * as React from "react";
import type * as DialogPrimitive from "@radix-ui/react-dialog";
import type * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";

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

const MODAL_CONFIRM_SELECTOR = [
  '[data-dialog-confirm="true"]:not([disabled]):not([aria-disabled="true"])',
  '[data-alert-dialog-action="true"]:not([disabled]):not([aria-disabled="true"])',
].join(", ");

const MODAL_SHORTCUT_CLOSE_SELECTOR = [
  '[data-modal-shortcut-close="true"]',
  '[data-modal-close="true"]',
  '[data-alert-dialog-cancel="true"]',
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
    const focusTarget =
      content.querySelector<HTMLElement>(MODAL_FORM_CONTROL_SELECTOR) ??
      content.querySelector<HTMLElement>(MODAL_CONFIRM_SELECTOR) ??
      getModalFocusableElements(content)[0] ??
      content;
    focusTarget.focus();
  };
};

const isSubmitShortcut = (event: React.KeyboardEvent<HTMLElement>) =>
  event.key === "Enter" && event.metaKey && !event.ctrlKey && !event.altKey && !event.shiftKey && !(event.nativeEvent as KeyboardEvent).isComposing;

const closeModalFromContent = (content: HTMLElement) => {
  const closeTrigger = content.querySelector<HTMLElement>(MODAL_SHORTCUT_CLOSE_SELECTOR);
  closeTrigger?.click();
};

const submitFirstFormInContent = (content: HTMLElement) => {
  const form = content.querySelector<HTMLFormElement>("form");
  if (!form) return false;
  form.requestSubmit();
  return true;
};

const triggerConfirmActionInContent = (content: HTMLElement) => {
  const confirmAction = content.querySelector<HTMLElement>(MODAL_CONFIRM_SELECTOR);
  if (!confirmAction) return false;
  confirmAction.click();
  return true;
};

export const getModalKeyDownHandler = (
  onKeyDown?: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>["onKeyDown"]
    | React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Content>["onKeyDown"],
) => {
  return (event: React.KeyboardEvent<HTMLElement>) => {
    (onKeyDown as ((event: React.KeyboardEvent<HTMLElement>) => void) | undefined)?.(event);
    if (event.defaultPrevented) return;

    const content = event.currentTarget;

    if (isSubmitShortcut(event)) {
      event.preventDefault();
      if (!submitFirstFormInContent(content)) {
        triggerConfirmActionInContent(content);
      }
      closeModalFromContent(content);
      return;
    }

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
