/**
 * AIF Diagram Search
 * 
 * Search and filter nodes within the graph by text content.
 * Highlights matching nodes and allows navigation.
 */

'use client';

import { useState, useMemo, useEffect } from 'react';
import type { AifSubgraph, AifNode } from '@/lib/arguments/diagram';

export interface SearchResult {
  node: AifNode;
  matchType: 'label' | 'text' | 'id' | 'schemeKey';
  excerpt?: string;
}

/**
 * Search nodes in the graph
 */
export function searchGraph(
  graph: AifSubgraph,
  query: string
): SearchResult[] {
  if (!query.trim()) return [];
  
  const lowerQuery = query.toLowerCase().trim();
  const results: SearchResult[] = [];
  
  for (const node of graph.nodes) {
    // Search in label
    if (node.label?.toLowerCase().includes(lowerQuery)) {
      results.push({
        node,
        matchType: 'label',
        excerpt: getExcerpt(node.label, lowerQuery),
      });
      continue;
    }
    
    // Search in text (for I-nodes)
    const nodeText = (node as AifNode & { text?: string | null }).text;
    if (nodeText?.toLowerCase().includes(lowerQuery)) {
      results.push({
        node,
        matchType: 'text',
        excerpt: getExcerpt(nodeText, lowerQuery),
      });
      continue;
    }
    
    // Search in ID
    if (node.id.toLowerCase().includes(lowerQuery)) {
      results.push({
        node,
        matchType: 'id',
      });
      continue;
    }
    
    // Search in scheme key
    if (node.schemeKey?.toLowerCase().includes(lowerQuery)) {
      results.push({
        node,
        matchType: 'schemeKey',
      });
    }
  }
  
  return results;
}

/**
 * Get excerpt around match
 */
function getExcerpt(text: string, query: string, contextLength = 40): string {
  const index = text.toLowerCase().indexOf(query.toLowerCase());
  if (index === -1) return text.substring(0, contextLength) + '...';
  
  const start = Math.max(0, index - contextLength / 2);
  const end = Math.min(text.length, index + query.length + contextLength / 2);
  
  let excerpt = text.substring(start, end);
  if (start > 0) excerpt = '...' + excerpt;
  if (end < text.length) excerpt = excerpt + '...';
  
  return excerpt;
}

/**
 * Highlight query in text
 */
function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function highlightMatch(text: string, query: string): React.ReactNode {
    if (!query) return text;
  const safe = escapeRegExp(query);
  const parts = text.split(new RegExp(`(${safe})`, 'gi'));
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase() ? (
      <mark key={i} className="bg-yellow-200 font-semibold">
        {part}
      </mark>
    ) : (
      part
    )
  );
}

/**
 * Search Component
 */
export function AifDiagramSearch({
  graph,
  onResultSelect,
  onSearchChange,
  className = '',
}: {
  graph: AifSubgraph;
  onResultSelect?: (result: SearchResult) => void;
  onSearchChange?: (results: SearchResult[]) => void;
  className?: string;
}) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  
  // Search results
  const results = useMemo(() => searchGraph(graph, query), [graph, query]);

  // Notify parent AFTER render to avoid "update while rendering" warning
  useEffect(() => {
    onSearchChange?.(results);
  }, [results, onSearchChange]);

  // Handle search input
  function handleQueryChange(value: string) {
    setQuery(value);
    setSelectedIndex(0);
    setIsOpen(value.trim().length > 0);
  }

  // Handle result selection
  function handleResultClick(result: SearchResult, index: number) {
    setSelectedIndex(index);
    onResultSelect?.(result);
    setIsOpen(false);
  }

  // Keyboard navigation
      function handleKeyDown(e: React.KeyboardEvent) {
    if (!isOpen) return;
    if (results.length === 0) {
      if (e.key === 'Escape') setIsOpen(false);
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (results[selectedIndex]) {
          handleResultClick(results[selectedIndex], selectedIndex);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        break;
    }
  }

  // Open dropdown when typing
  useEffect(() => {
    if (query.trim().length > 0) {
      setIsOpen(true);
    }
  }, [query]);
  // Keep the selected index in range if the results list changes
  useEffect(() => {
    if (selectedIndex > Math.max(0, results.length - 1)) {
      setSelectedIndex(0);
    }
  }, [results.length, selectedIndex]);
  return (
    <div className={`relative ${className}`}>
      {/* Search Input */}
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => query.trim() && setIsOpen(true)}
          placeholder="Search nodes..."
          className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
        />
        
        {/* Search Icon */}
        <svg
          className="absolute left-3 top-2.5 w-4 h-4 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        
        {/* Clear Button */}
        {query && (
          <button
            onClick={() => handleQueryChange('')}
            className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        )}
      </div>

      {/* Results Dropdown */}
      {isOpen && results.length > 0 && (
        <div className="absolute z-50 w-full mt-2 bg-white border border-gray-300 rounded-lg shadow-lg max-h-96 overflow-y-auto">
          <div className="px-3 py-2 text-xs text-gray-500 border-b border-gray-200">
            {results.length} result{results.length !== 1 ? 's' : ''}
          </div>
          
          {results.map((result, index) => (
            <button
              key={result.node.id}
              onClick={() => handleResultClick(result, index)}
              className={`w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0 transition-colors ${
                index === selectedIndex ? 'bg-sky-50' : ''
              }`}
            >
              <div className="flex items-start gap-2">
                {/* Node Type Badge */}
                <span
                  className={`px-2 py-0.5 text-xs font-medium rounded ${
                    result.node.kind === 'I'
                      ? 'bg-yellow-100 text-yellow-800'
                      : result.node.kind === 'RA'
                      ? 'bg-sky-100 text-sky-800'
                      : result.node.kind === 'CA'
                      ? 'bg-red-100 text-red-800'
                      : 'bg-green-100 text-green-800'
                  }`}
                >
                  {result.node.kind}
                </span>
                
                {/* Match Content */}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">
                    {result.excerpt ? (
                      highlightMatch(result.excerpt, query)
                    ) : (
                      highlightMatch(result.node.label || result.node.id, query)
                    )}
                  </div>
                  
                  {result.matchType === 'schemeKey' && result.node.schemeKey && (
                    <div className="text-xs text-gray-500 mt-1">
                      Scheme: {highlightMatch(result.node.schemeKey, query)}
                    </div>
                  )}
                  
                  {result.matchType === 'id' && (
                    <div className="text-xs text-gray-500 mt-1">
                      ID: {highlightMatch(result.node.id, query)}
                    </div>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
      
      {/* No Results */}
      {isOpen && query.trim() && results.length === 0 && (
        <div className="absolute z-50 w-full mt-2 bg-white border border-gray-300 rounded-lg shadow-lg p-4">
          <div className="text-sm text-gray-500 text-center">
            No nodes found matching "{query}"
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Hook to manage search state and highlighting
 */
export function useGraphSearch(graph: AifSubgraph) {
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(null);
  
  const highlightedNodeIds = useMemo(() => {
    return new Set(searchResults.map(r => r.node.id));
  }, [searchResults]);
  
  return {
    searchResults,
    selectedResult,
    highlightedNodeIds,
    onSearchChange: setSearchResults,
    onResultSelect: setSelectedResult,
  };
}