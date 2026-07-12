"use client";
import { useEffect } from "react";

export function useKeyPress(key: string, handler: () => void) {
  useEffect(() => {
    function listener(e: KeyboardEvent) {
      if (e.key.toLowerCase() === key.toLowerCase()) {
        handler();
      }
    }
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [key, handler]);
}
