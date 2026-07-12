'use client';
import { useEffect } from 'react';
import type cytoscape from 'cytoscape';

type Instance = { targetType: 'claim'|'card'; targetId: string; scheme: { key: string; title: string } };

export default function SchemeOverlay({
  cy,
  instances,
}: {
  cy: cytoscape.Core | null;
  instances: Instance[];
}) {
  useEffect(() => {
    if (!cy) return;
    // Simple: add a little badge to nodes that have a scheme instance
    instances.forEach(i => {
      if (i.targetType !== 'claim') return;
      const n = cy.getElementById(i.targetId);
      if (n.nonempty()) {
        n.data('schemeTitle', i.scheme.title);
        n.addClass('has-scheme');
      }
    });
    return () => {
      instances.forEach(i => {
        if (i.targetType !== 'claim') return;
        const n = cy.getElementById(i.targetId);
        if (n.nonempty()) n.removeClass('has-scheme');
      });
    };
  }, [cy, instances]);

  return null;
}
