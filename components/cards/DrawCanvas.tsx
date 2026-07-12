"use client";

import { useEffect, useRef, useState } from "react";
import { Tldraw, track, useEditor } from "tldraw";
import { usePathname } from "next/navigation";
import {
  fetchRealtimePostById,
  updateRealtimePost,
} from "@/lib/actions/realtimepost.actions";
import "tldraw/tldraw.css";

interface DrawCanvasProps {
  id: string;
  content?: string;
}

const CustomUi = track(() => {
  const editor = useEditor()

  useEffect(() => {
    const handleKeyUp = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Delete':
        case 'Backspace': {
          editor.deleteShapes(editor.getSelectedShapeIds())
          break
        }
        case 'v': {
          editor.setCurrentTool('select')
          break
        }
        case 'e': {
          editor.setCurrentTool('eraser')
          break
        }
        case 'x':
        case 'p':
        case 'b':
        case 'd': {
          editor.setCurrentTool('draw')
          break
        }
      }
    }

    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keyup', handleKeyUp)
    }
  })

  return (
    <div className="custom-layout-draw">
      <div className="custom-toolbar-draw">
        <button
          className="custom-button-draw"
          data-isactive={editor.getCurrentToolId() === 'select'}
          onClick={() => editor.setCurrentTool('select')}
        >
          Select
        </button>
        <button
          className="custom-button-draw"
          data-isactive={editor.getCurrentToolId() === 'draw'}
          onClick={() => editor.setCurrentTool('draw')}
        >
          Pencil
        </button>
        <button
          className="custom-button-draw"
          data-isactive={editor.getCurrentToolId() === 'eraser'}
          onClick={() => editor.setCurrentTool('eraser')}
        >
          Eraser
        </button>
      </div>
    </div>
  )
})

const DrawCanvas = ({ id, content }: DrawCanvasProps) => {
  const path = usePathname();
  const editorRef = useRef<any>(null);
  const [editorReady, setEditorReady] = useState(false);
  const lastLoaded = useRef<string | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!editorReady || !editorRef.current) return;
    fetchRealtimePostById({ id }).then((post) => {
      if (post?.content) {
        try {
          editorRef.current.store.loadStoreSnapshot(
            JSON.parse(post.content)
          );
          lastLoaded.current = post.content;
        } catch (e) {
          console.error(e);
        }
      }
    });

    const unsub = editorRef.current.store.listen(() => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        const snapshot = editorRef.current.store.getStoreSnapshot();
        const json = JSON.stringify(snapshot);
        lastLoaded.current = json;
        updateRealtimePost({ id, path: path ?? "", content: json });
      }, 500);
    });
    return () => {
      unsub();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [editorReady, id, path]);

  useEffect(() => {
    if (editorReady && editorRef.current && content && content !== lastLoaded.current) {
      try {
        editorRef.current.store.loadStoreSnapshot(JSON.parse(content));
        lastLoaded.current = content;
      } catch (e) {
        console.error(e);
      }
    }
  }, [editorReady, content]);

  return (
    <div className="flex justify-center">
      <div className="w-[45rem] h-[24rem]  rounded-md">
      <Tldraw hideUi
             options={{ maxPages: 1 }} 
              onMount={(editor) => {
                editorRef.current = editor;
                editor.setCurrentTool('draw');
                setEditorReady(true);
              }}
            >
                    <CustomUi />
</Tldraw>
      </div>
    </div>
  );
};

export default DrawCanvas;