import * as React from "react";
import type { CSSProperties } from "react";

export const MODAL_MOBILE_BREAKPOINT = 768;

export type ModalViewportStyle = CSSProperties & {
  "--bathos-modal-vv-height": string;
  "--bathos-modal-vv-top": string;
};

export function isMobileViewport() {
  if (typeof window === "undefined") return false;
  return window.innerWidth < MODAL_MOBILE_BREAKPOINT;
}

function getModalViewportStyle(): ModalViewportStyle {
  if (typeof window === "undefined") {
    return {
      "--bathos-modal-vv-height": "100dvh",
      "--bathos-modal-vv-top": "0px",
    };
  }

  const visualViewport = window.visualViewport;
  const height = Math.max(0, Math.round(visualViewport?.height ?? window.innerHeight));
  const top = Math.max(0, Math.round(visualViewport?.offsetTop ?? 0));

  return {
    "--bathos-modal-vv-height": `${height}px`,
    "--bathos-modal-vv-top": `${top}px`,
  };
}

export function useModalViewportStyle(style?: CSSProperties): ModalViewportStyle {
  const [viewportStyle, setViewportStyle] = React.useState<ModalViewportStyle>(getModalViewportStyle);

  React.useEffect(() => {
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
  }, []);

  return {
    ...viewportStyle,
    ...style,
  };
}
