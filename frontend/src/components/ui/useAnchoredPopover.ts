import { useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from "react";

/** Keep a portaled menu next to its trigger, including inside scrolling dialogs. */
export function useAnchoredPopover(
  open: boolean,
  anchor: RefObject<HTMLElement>,
  { minWidth = 192, maxHeight = 304, align = "start" }: { minWidth?: number; maxHeight?: number; align?: "start" | "end" } = {},
) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<CSSProperties>({ position: "fixed", visibility: "hidden" });

  useLayoutEffect(() => {
    if (!open || !anchor.current) return;
    const update = () => {
      const trigger = anchor.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const viewport = window.visualViewport;
      const topEdge = viewport?.offsetTop ?? 0;
      const leftEdge = viewport?.offsetLeft ?? 0;
      const viewportWidth = viewport?.width ?? window.innerWidth;
      const viewportHeight = viewport?.height ?? window.innerHeight;
      const bottomEdge = topEdge + viewportHeight;
      const gap = 8;
      const margin = 12;
      const width = Math.min(Math.max(rect.width, minWidth), viewportWidth - margin * 2);
      const below = bottomEdge - rect.bottom - gap - margin;
      const above = rect.top - topEdge - gap - margin;
      const desiredHeight = Math.min(popoverRef.current?.scrollHeight || maxHeight, maxHeight);
      const placeAbove = below < desiredHeight && above > below;
      const available = Math.max(0, placeAbove ? above : below);
      const height = Math.min(maxHeight, available);
      const contentHeight = Math.min(desiredHeight, height);
      const left = Math.max(leftEdge + margin, Math.min(
        align === "end" ? rect.right - width : rect.left,
        leftEdge + viewportWidth - width - margin,
      ));
      const next: CSSProperties = {
        position: "fixed", zIndex: 1100, width, left,
        top: placeAbove ? Math.max(topEdge + margin, rect.top - gap - contentHeight) : rect.bottom + gap,
        maxHeight: height, visibility: "visible",
      };
      setStyle((previous) => Object.keys(next).every((key) => previous[key as keyof CSSProperties] === next[key as keyof CSSProperties]) ? previous : next);
    };
    update();
    const resize = new ResizeObserver(update);
    resize.observe(anchor.current);
    if (popoverRef.current) resize.observe(popoverRef.current);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    window.visualViewport?.addEventListener("resize", update);
    window.visualViewport?.addEventListener("scroll", update);
    return () => {
      resize.disconnect();
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
      window.visualViewport?.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("scroll", update);
    };
  }, [open, anchor, minWidth, maxHeight, align]);

  return { popoverRef, style };
}
