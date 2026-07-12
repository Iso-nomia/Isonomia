'use client';

import { useEffect } from 'react';

export function SectionState({
  articleId,
  defaultExpanded = true,
  containerSelector = '.article-body',
}: {
  articleId?: string;
  defaultExpanded?: boolean;
  containerSelector?: string;
}) {
  useEffect(() => {
    const root = (document.querySelector(containerSelector) as HTMLElement) || document.body;
    const sections = Array.from(root.querySelectorAll<HTMLDetailsElement>('.article-section'));
    const key = articleId ? `article:${articleId}:sections` : null;

    // restore
    try {
      const saved = key ? JSON.parse(localStorage.getItem(key) || '[]') : null;
      if (Array.isArray(saved) && saved.length === sections.length) {
        sections.forEach((el, i) => { el.open = !!saved[i]; });
      } else {
        sections.forEach(el => { el.open = !!defaultExpanded; });
      }
    } catch {
      sections.forEach(el => { el.open = !!defaultExpanded; });
    }

    const onToggle = () => {
      if (!key) return;
      try {
        const arr = sections.map(s => (s.open ? 1 : 0));
        localStorage.setItem(key, JSON.stringify(arr));
      } catch {}
    };
    sections.forEach(s => s.addEventListener('toggle', onToggle));
    return () => sections.forEach(s => s.removeEventListener('toggle', onToggle));
  }, [articleId, defaultExpanded, containerSelector]);

  // optional: expand/collapse all buttons
  useEffect(() => {
    const root = (document.querySelector(containerSelector) as HTMLElement) || document.body;
    const sections = () => Array.from(root.querySelectorAll<HTMLDetailsElement>('.article-section'));
    const handler = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t) return;
      if (t.matches('[data-collapse-all]')) sections().forEach(s => (s.open = false));
      if (t.matches('[data-expand-all]'))   sections().forEach(s => (s.open = true));
    };
    document.addEventListener('click', handler, true);
    return () => document.removeEventListener('click', handler, true);
  }, [containerSelector]);

  return null;
}
