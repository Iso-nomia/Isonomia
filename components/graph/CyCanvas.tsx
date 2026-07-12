'use client';
import { useEffect, useRef, useState } from 'react';
import cytoscape, { StylesheetStyle, StylesheetCSS, ElementDefinition, Core } from 'cytoscape';

type Stylesheet = StylesheetStyle | StylesheetCSS;

type Props = {
  elements: ElementDefinition[];
  stylesheet: Stylesheet[];
  height?: number;
  onReady?: (cy: Core) => void;
};

export default function CyCanvas({ elements, stylesheet, height=420, onReady }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);
  const [zoom, setZoom] = useState(1);

  function handleZoomChange(e: React.ChangeEvent<HTMLInputElement>) {
    const z = parseFloat(e.target.value);
    setZoom(z);
    cyRef.current?.zoom(z);
    cyRef.current?.center();
  }


  useEffect(() => {
    if (!containerRef.current) return;

    // Destroy old instance if hot reloading
    if (cyRef.current) {
      cyRef.current.destroy();
      cyRef.current = null;
    }

    // Initialize
    cyRef.current = cytoscape({
      container: containerRef.current,
      elements,
      style: stylesheet,
      layout: { name: 'cose', animate: false },
      userZoomingEnabled: true,
    });

    if (onReady) onReady(cyRef.current);

    return () => {
      cyRef.current?.destroy();
      cyRef.current = null;
    };
  }, [elements, stylesheet, onReady]);

  return <div ref={containerRef} style={{ width: '100%', height }} />;
}
