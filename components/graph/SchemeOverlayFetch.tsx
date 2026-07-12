'use client';
import useSWR from 'swr';
import { useEffect } from 'react';
import type cytoscape from 'cytoscape';

const fetcher = (u: string) => fetch(u, { cache: 'no-store' }).then(r => r.json());

type Instance = {
  id: string;
  targetType: 'claim'|'card';
  targetId: string;
  scheme: { key: string; title: string };
  data: any;
};

export default function SchemeOverlayFetch({
  deliberationId,
  cy,
  onOpenCQ,
}: {
  deliberationId: string;
  cy: cytoscape.Core | null;
  onOpenCQ?: (claimId: string) => void;
}) {
  const { data } = useSWR<{ instances: Instance[] }>(
    `/api/schemes/instances?deliberationId=${deliberationId}&targetType=claim`,
    fetcher
  );
  const instances = data?.instances ?? [];

  useEffect(() => {
    if (!cy) return;
    // Mark nodes with scheme instances
    instances.forEach(inst => {
      if (inst.targetType !== 'claim') return;
      const n = cy.getElementById(inst.targetId);
      if (n.nonempty()) {
        n.data('schemeIcon', '/icons/scheme-expert.svg'); // replace with your icon
        n.addClass('has-scheme');
      }
    });

    // Tap handler for nodes with scheme
    function onTap(evt: any) {
      const n = evt.target;
      if (!n.hasClass('has-scheme')) return;
      onOpenCQ?.(n.id()); // open CriticalQuestions panel for this claim
    }
    cy.on('tap', 'node.has-scheme', onTap);

    return () => {
      try {
        cy.off('tap', 'node.has-scheme', onTap);
        instances.forEach(inst => {
          const n = cy.getElementById(inst.targetId);
          if (n.nonempty()) n.removeClass('has-scheme');
        });
      } catch {}
    };
  }, [cy, instances, onOpenCQ]);

  return null;
}
