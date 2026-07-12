"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";

type CaretPos = { top: number; left: number; height: number };

/**
 * A custom (fake) text caret for the Tiptap editor. The native caret is hidden
 * via CSS (see `.cp-has-fake-caret` in globals.css); this renders an absolutely
 * positioned bar at the current insertion point.
 *
 * Must be rendered inside a `position: relative` container that also wraps the
 * editor, since positions are computed relative to that container.
 *
 * Behaviour:
 *  - Only shown when the editor is focused and the selection is collapsed.
 *  - Follows typing, arrow keys, clicks, scrolling, and resizing.
 *  - Blink resets (stays solid) on every move so it reads clearly while typing.
 */
export default function FakeCaret({
  editor,
  containerRef,
  color = "#1c1917",
  width = 1,
}: {
  editor: Editor;
  containerRef: React.RefObject<HTMLElement>;
  color?: string;
  width?: number;
}) {
  const [pos, setPos] = useState<CaretPos | null>(null);
  const rafRef = useRef<number | null>(null);

  const recalc = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    if (!editor.isFocused || !editor.state.selection.empty) {
      setPos(null);
      return;
    }

    try {
      const head = editor.state.selection.head;
      const coords = editor.view.coordsAtPos(head);
      const rect = container.getBoundingClientRect();
      setPos({
        top: coords.top - rect.top + container.scrollTop,
        left: coords.left - rect.left + container.scrollLeft ,
        height: Math.max(coords.bottom - coords.top, 12),
      });
    } catch {
      // coordsAtPos can throw during transient states; ignore this frame.
    }
  }, [editor, containerRef]);

  // Coalesce bursts of events (typing, scroll) into one measurement per frame.
  const schedule = useCallback(() => {
    if (rafRef.current != null) return;
    rafRef.current = window.requestAnimationFrame(() => {
      rafRef.current = null;
      recalc();
    });
  }, [recalc]);

  useEffect(() => {
    schedule();
    editor.on("selectionUpdate", schedule);
    editor.on("transaction", schedule);
    editor.on("focus", schedule);
    editor.on("blur", schedule);
    window.addEventListener("scroll", schedule, true);
    window.addEventListener("resize", schedule);
    return () => {
      editor.off("selectionUpdate", schedule);
      editor.off("transaction", schedule);
      editor.off("focus", schedule);
      editor.off("blur", schedule);
      window.removeEventListener("scroll", schedule, true);
      window.removeEventListener("resize", schedule);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [editor, schedule]);

  if (!pos) return null;

  return (
    <span
      // Keying on position remounts the element when the caret moves, which
      // restarts the blink animation so the caret is solid while typing.
      key={`${Math.round(pos.top)}:${Math.round(pos.left)}`}
      aria-hidden
      className="cp-fake-caret pointer-events-none absolute z-10"
      style={{
        top: pos.top,
        left: pos.left,
        height: pos.height,
        width: width,
        backgroundColor: color,
        borderRadius: 1,
      }}
    />
  );
}
