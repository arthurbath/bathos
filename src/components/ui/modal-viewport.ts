import * as React from "react";
import type { CSSProperties } from "react";

export const MODAL_MOBILE_BREAKPOINT = 768;

export type ModalViewportStyle = CSSProperties & {
  "--bathos-modal-vv-height": string;
  "--bathos-modal-vv-top": string;
  "--bathos-modal-vv-center": string;
};

export function isMobileViewport() {
  if (typeof window === "undefined") return false;
  return window.innerWidth < MODAL_MOBILE_BREAKPOINT;
}

export function isTouchCapableDevice() {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  return navigator.maxTouchPoints > 0
    || window.matchMedia?.("(pointer: coarse)").matches === true;
}

export function isMobileTouchViewport() {
  return isMobileViewport() && isTouchCapableDevice();
}

function getModalViewportStyle(): ModalViewportStyle {
  if (typeof window === "undefined") {
    return {
      "--bathos-modal-vv-height": "100dvh",
      "--bathos-modal-vv-top": "0px",
      "--bathos-modal-vv-center": "50dvh",
    };
  }

  const visualViewport = window.visualViewport;
  const height = Math.max(0, Math.round(visualViewport?.height ?? window.innerHeight));
  const top = Math.max(0, Math.round(visualViewport?.offsetTop ?? 0));

  return {
    "--bathos-modal-vv-height": `${height}px`,
    "--bathos-modal-vv-top": `${top}px`,
    "--bathos-modal-vv-center": `${top + (height / 2)}px`,
  };
}

export function useIsMobileTouchViewport() {
  const [mobileTouchViewport, setMobileTouchViewport] = React.useState(isMobileTouchViewport);

  React.useEffect(() => {
    const mobileQuery = window.matchMedia?.(
      `(max-width: ${MODAL_MOBILE_BREAKPOINT - 1}px)`,
    );
    const coarsePointerQuery = window.matchMedia?.("(pointer: coarse)");
    const update = () => setMobileTouchViewport(isMobileTouchViewport());

    update();
    mobileQuery?.addEventListener?.("change", update);
    coarsePointerQuery?.addEventListener?.("change", update);
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);

    return () => {
      mobileQuery?.removeEventListener?.("change", update);
      coarsePointerQuery?.removeEventListener?.("change", update);
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, []);

  return mobileTouchViewport;
}

export function useModalViewportStyle(
  style?: CSSProperties,
  active = true,
): ModalViewportStyle {
  const [viewportStyle, setViewportStyle] = React.useState<ModalViewportStyle>(getModalViewportStyle);

  React.useEffect(() => {
    if (!active) return undefined;
    const updateStyle = () => {
      setViewportStyle(getModalViewportStyle());
    };

    const visualViewport = window.visualViewport;
    updateStyle();

    visualViewport?.addEventListener("resize", updateStyle);
    visualViewport?.addEventListener("scroll", updateStyle);
    window.addEventListener("resize", updateStyle);
    window.addEventListener("orientationchange", updateStyle);

    return () => {
      visualViewport?.removeEventListener("resize", updateStyle);
      visualViewport?.removeEventListener("scroll", updateStyle);
      window.removeEventListener("resize", updateStyle);
      window.removeEventListener("orientationchange", updateStyle);
    };
  }, [active]);

  return {
    ...viewportStyle,
    ...style,
  };
}
