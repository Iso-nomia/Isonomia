/**
 * AIF Diagram Export
 * 
 * Export diagrams as SVG or PNG files.
 * Includes metadata and styling preservation.
 */

'use client';

import { useState } from 'react';
import type { AifSubgraph } from '@/lib/arguments/diagram';

export interface ExportOptions {
  format: 'svg' | 'png';
  filename?: string;
  includeBackground?: boolean;
  backgroundColor?: string;
  scale?: number; // For PNG export
  quality?: number; // For PNG export (0-1)
}

/**
 * Export SVG element to file
 */
export async function exportDiagram(
  svgElement: SVGSVGElement,
  options: ExportOptions
): Promise<void> {
  const {
    format = 'svg',
    filename = `aif-diagram-${Date.now()}`,
    includeBackground = true,
    backgroundColor = '#ffffff',
    scale = 2,
    quality = 0.95,
  } = options;

  if (format === 'svg') {
    await exportAsSVG(svgElement, filename, includeBackground, backgroundColor);
  } else {
    await exportAsPNG(svgElement, filename, includeBackground, backgroundColor, scale, quality);
  }
}

/**
 * Export as SVG file
 */
async function exportAsSVG(
  svgElement: SVGSVGElement,
  filename: string,
  includeBackground: boolean,
  backgroundColor: string
): Promise<void> {
  // Clone the SVG to avoid modifying the original
  const clonedSvg = svgElement.cloneNode(true) as SVGSVGElement;
  
  // Add background if requested
  if (includeBackground) {
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('width', '100%');
    rect.setAttribute('height', '100%');
    rect.setAttribute('fill', backgroundColor);
    clonedSvg.insertBefore(rect, clonedSvg.firstChild);
  }
  
  // Add metadata
  const metadata = document.createElementNS('http://www.w3.org/2000/svg', 'metadata');
  metadata.textContent = `
    <export>
      <generator>AIF Diagram Viewer</generator>
      <date>${new Date().toISOString()}</date>
      <format>SVG</format>
    </export>
  `;
  clonedSvg.appendChild(metadata);
  
  // Serialize to string
  const serializer = new XMLSerializer();
  let svgString = serializer.serializeToString(clonedSvg);
  
  // Add XML declaration and ensure proper namespace
  svgString = '<?xml version="1.0" encoding="UTF-8"?>\n' + svgString;
  
  // Create blob and download
  const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  downloadBlob(blob, `${filename}.svg`);
}

/**
 * Export as PNG file
 */
async function exportAsPNG(
  svgElement: SVGSVGElement,
  filename: string,
  includeBackground: boolean,
  backgroundColor: string,
  scale: number,
  quality: number
): Promise<void> {
  // Get SVG dimensions
  const bbox = svgElement.getBoundingClientRect();
  const width = bbox.width * scale;
  const height = bbox.height * scale;
  
  // Clone and prepare SVG
  const clonedSvg = svgElement.cloneNode(true) as SVGSVGElement;
  
  // Add background
  if (includeBackground) {
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('width', '100%');
    rect.setAttribute('height', '100%');
    rect.setAttribute('fill', backgroundColor);
    clonedSvg.insertBefore(rect, clonedSvg.firstChild);
  }
  
  // Serialize SVG
  const serializer = new XMLSerializer();
  const svgString = serializer.serializeToString(clonedSvg);
  
  // Create canvas
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  
  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }
  
  // Draw background if needed
  if (includeBackground) {
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, width, height);
  }
  
  // Convert SVG to image
  const img = new Image();
  const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);
  
  return new Promise((resolve, reject) => {
    img.onload = () => {
      ctx.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      
      // Convert canvas to blob
      canvas.toBlob(
        (blob) => {
          if (blob) {
            downloadBlob(blob, `${filename}.png`);
            resolve();
          } else {
            reject(new Error('Failed to create PNG blob'));
          }
        },
        'image/png',
        quality
      );
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load SVG image'));
    };
    
    img.src = url;
  });
}

/**
 * Download blob as file
 */
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export Menu Component
 */
export function AifDiagramExportMenu({
  svgRef,
  graph,
  className = '',
}: {
  svgRef: React.RefObject<SVGSVGElement>;
  graph: AifSubgraph;
  className?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  
  async function handleExport(format: 'svg' | 'png') {
    if (!svgRef.current) {
      alert('SVG element not found');
      return;
    }
    
    setIsExporting(true);
    
    try {
      await exportDiagram(svgRef.current, {
        format,
        filename: `aif-diagram-${graph.nodes.length}-nodes`,
        includeBackground: true,
        backgroundColor: '#ffffff',
        scale: 2,
        quality: 0.95,
      });
      
      setIsOpen(false);
    } catch (error) {
      console.error('Export failed:', error);
      alert(`Failed to export as ${format.toUpperCase()}: ${error}`);
    } finally {
      setIsExporting(false);
    }
  }
  
  return (
    <div className={`relative ${className}`}>
      {/* Export Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isExporting}
        className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
          />
        </svg>
        {isExporting ? 'Exporting...' : 'Export'}
      </button>
      
      {/* Dropdown Menu */}
      {isOpen && !isExporting && (
        <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-300 rounded-lg shadow-lg z-50">
          <div className="px-3 py-2 text-xs text-gray-500 border-b border-gray-200">
            Export as...
          </div>
          
          <button
            onClick={() => handleExport('svg')}
            className="w-full text-left px-4 py-3 hover:bg-gray-50 text-sm text-gray-700 border-b border-gray-100"
          >
            <div className="font-medium">SVG Vector</div>
            <div className="text-xs text-gray-500 mt-0.5">
              Scalable, editable format
            </div>
          </button>
          
          <button
            onClick={() => handleExport('png')}
            className="w-full text-left px-4 py-3 hover:bg-gray-50 text-sm text-gray-700"
          >
            <div className="font-medium">PNG Image</div>
            <div className="text-xs text-gray-500 mt-0.5">
              High-res raster (2x scale)
            </div>
          </button>
          
          <div className="px-4 py-2 text-xs text-gray-400 border-t border-gray-200">
            {graph.nodes.length} nodes, {graph.edges.length} edges
          </div>
        </div>
      )}
      
      {/* Click outside to close */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}

/**
 * Copy SVG to clipboard
 */
export async function copySvgToClipboard(svgElement: SVGSVGElement): Promise<void> {
  const serializer = new XMLSerializer();
  const svgString = serializer.serializeToString(svgElement);
  
  try {
    await navigator.clipboard.writeText(svgString);
  } catch (error) {
    console.error('Failed to copy SVG to clipboard:', error);
    throw error;
  }
}

/**
 * Export graph data as JSON
 */
export function exportGraphAsJSON(graph: AifSubgraph, filename?: string): void {
  const jsonString = JSON.stringify(graph, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  downloadBlob(blob, filename || `aif-graph-${Date.now()}.json`);
}