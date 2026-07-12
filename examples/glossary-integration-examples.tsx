// Example: How to integrate glossary linking into a text editor
// This file shows integration patterns - not meant to be run directly

import { useState, useRef } from "react";
import { Textarea } from "@/components/ui/textarea";
import { GlossaryEditorToolbar } from "@/components/glossary/GlossaryEditorToolbar";
import { GlossaryText } from "@/components/glossary/GlossaryText";
import { Button } from "@/components/ui/button";

/**
 * Example 1: Simple Claim Composer with Glossary Linking
 */
export function SimpleClaimComposer({ deliberationId }: { deliberationId: string }) {
  const [text, setText] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const insertAtCursor = (syntax: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newText = text.slice(0, start) + syntax + text.slice(end);
    
    setText(newText);
    
    // Move cursor after inserted text
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + syntax.length, start + syntax.length);
    }, 0);
  };

  return (
    <div className="space-y-3">
      <GlossaryEditorToolbar
        deliberationId={deliberationId}
        onInsertTerm={(syntax) => insertAtCursor(syntax)}
        showPreview={showPreview}
        onTogglePreview={setShowPreview}
      />
      
      {showPreview ? (
        <div className="p-4 rounded-lg bg-slate-800/60 border border-white/20 min-h-32">
          <GlossaryText text={text} className="text-white" as="div" />
        </div>
      ) : (
        <Textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Write your claim... Use 'Link Term' to add glossary references"
          className="min-h-32"
        />
      )}
      
      <Button type="submit">Submit Claim</Button>
    </div>
  );
}

/**
 * Example 2: Display Existing Content with Glossary Links
 */
export function ClaimDisplay({ claim }: { claim: { conclusion: string } }) {
  return (
    <div className="p-4 bg-slate-800/40 rounded-lg">
      <h3 className="text-sm font-semibold text-slate-400 mb-2">Conclusion</h3>
      <GlossaryText 
        text={claim.conclusion}
        className="text-lg text-white leading-relaxed"
        as="p"
      />
    </div>
  );
}

/**
 * Example 3: Auto-detect and Suggest Linking
 */
export function SmartClaimComposer({ 
  deliberationId,
  glossaryTerms 
}: { 
  deliberationId: string;
  glossaryTerms: Array<{ id: string; term: string }>;
}) {
  const [text, setText] = useState("");
  const [suggestions, setSuggestions] = useState<Array<{ term: string; id: string }>>([]);

  const handleTextChange = (newText: string) => {
    setText(newText);
    
    // Detect words that match glossary terms
    const words = newText.toLowerCase().split(/\s+/);
    const matches = glossaryTerms.filter(gt => 
      words.some(word => word.includes(gt.term.toLowerCase()))
    );
    
    setSuggestions(matches);
  };

  const insertLink = (termId: string, termName: string) => {
    // Find the term in text and wrap it
    const regex = new RegExp(`\\b${termName}\\b`, 'gi');
    const newText = text.replace(regex, `[[${termId}:${termName}]]`);
    setText(newText);
    setSuggestions(suggestions.filter(s => s.id !== termId));
  };

  return (
    <div className="space-y-3">
      <Textarea
        value={text}
        onChange={(e) => handleTextChange(e.target.value)}
        placeholder="Start typing... We'll suggest glossary terms to link"
        className="min-h-32"
      />
      
      {suggestions.length > 0 && (
        <div className="p-3 bg-indigo-500/10 border border-indigo-400/40 rounded-lg">
          <p className="text-xs text-indigo-200 mb-2">
            Suggested glossary links:
          </p>
          <div className="flex flex-wrap gap-2">
            {suggestions.map(({ id, term }) => (
              <button
                key={id}
                onClick={() => insertLink(id, term)}
                className="px-2 py-1 text-xs bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-400/40 rounded text-indigo-200 transition-colors"
              >
                Link "{term}"
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Example 4: Rich Text Editor with Inline Glossary Detection
 */
export function RichTextEditorWithGlossary({ deliberationId }: { deliberationId: string }) {
  const [text, setText] = useState("");
  const [cursorPosition, setCursorPosition] = useState(0);
  const [showTermPicker, setShowTermPicker] = useState(false);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Detect "[[" trigger
    if (e.key === "[" && text[cursorPosition - 1] === "[") {
      setShowTermPicker(true);
    }
    
    // Escape to close picker
    if (e.key === "Escape" && showTermPicker) {
      setShowTermPicker(false);
    }
  };

  const insertTermAtCursor = (syntax: string) => {
    // Remove the "[["
    const newText = text.slice(0, cursorPosition - 1) + syntax + text.slice(cursorPosition);
    setText(newText);
    setShowTermPicker(false);
  };

  return (
    <div className="relative">
      <Textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setCursorPosition(e.target.selectionStart);
        }}
        onKeyDown={handleKeyDown}
        placeholder="Type [[ to trigger glossary term picker..."
        className="min-h-32"
      />
      
      {showTermPicker && (
        <div className="absolute top-full left-0 mt-1 z-50">
          {/* Show GlossaryTermPicker here */}
        </div>
      )}
    </div>
  );
}
