"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import { X, File as FileIcon, Paperclip } from "lucide-react";
import { useChatStore } from "@/contexts/useChatStore";
import { supabase } from "@/lib/supabaseclient";
import QuickPollModal from "@/components/chat/QuickPollModal";
import QuickTempModal from "@/components/chat/QuickTempModal";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { useConversationRealtime } from "@/hooks/useConversationRealtime";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"; // shadcn dialog
import { SheafComposer } from "../sheaf/SheafComposer";
interface Props {
  conversationId: string;
  currentUserId: string | number; // NEW
  driftId?: string;               // NEW (optional)
  currentUserName?: string;
   currentUserImage?: string | null;
  discussionId?: string, commentId?:string
}
type QuoteRef = { messageId: string; facetId?: string };

function asBlockquote(text: string) {
  return text.replace(/\r\n/g, "\n").split("\n").map(l => (l.trim() ? `> ${l}` : `>`)).join("\n");
}

export function plainFromNode(n: any): string {
  if (!n) return "";
  if (typeof n === "string") return n;
  if (Array.isArray(n)) return n.map(plainFromNode).join("");
  if (n.type === "text") return n.text || "";
  if (Array.isArray(n.content)) return n.content.map(plainFromNode).join("");
  return "";
}
function normalizeForumText(raw: string) {
  const s = raw?.trim() ?? "";
  if (!s) return "";
  if (s.startsWith("{") || s.startsWith("[")) {
    try {
      const obj = JSON.parse(s);
      // local plain-from-node to avoid circular imports
      const plain = (function plainFromNode(n:any): string {
        if (!n) return "";
        if (typeof n === "string") return n;
        if (Array.isArray(n)) return n.map(plainFromNode).join("");
        if (n.type === "text") return n.text || "";
        if (Array.isArray(n.content)) return n.content.map(plainFromNode).join("");
        return "";
      })(obj);
      return plain;
    } catch { /* fall through */ }
  }
  return s;
}

// const textareaRef = useRef<HTMLTextAreaElement | null>(null);


// const textareaRef = useRef<HTMLTextAreaElement | null>(null);

export default function MessageComposer({
  conversationId,
  currentUserId,
  driftId,
  currentUserName = "",
   currentUserImage = null,
  discussionId,
  commentId,
  
}: Props) {
  const appendMessage = useChatStore((s) => s.appendMessage);
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [previews, setPreviews] = useState<string[]>([]);
  const [showPoll, setShowPoll] = useState(false);
  const [showSheaf, setShowSheaf] = useState(false);
  const [showTemp, setShowTemp] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
//    const quoteDraft = useChatStore((s) => s.quoteDraftByConversationId[conversationId]);
//  const setQuoteDraft = useChatStore((s) => s.setQuoteDraft);
//  const clearQuoteDraft = () => setQuoteDraft(conversationId, undefined);
const textareaRef = useRef<HTMLTextAreaElement | null>(null);


const { sendTyping } = useConversationRealtime(
  conversationId,
  { id: String(currentUserId), name: String(currentUserName), image: currentUserImage }
);


  function onFilesSelected(list: FileList | null) {
    console.log("[files] selected", list?.length);
    if (!list) return;
    const filesArray = Array.from(list);
    const urls = filesArray.map((f) =>
      f.type.startsWith("image/") ? URL.createObjectURL(f) : ""
    );
    setFiles((prev) => [...prev, ...filesArray]);
    setPreviews((prev) => [...prev, ...urls]);
    // allow picking the same file twice
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removeFile(idx: number) {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
    setPreviews((prev) => {
      const [toRevoke] = prev.slice(idx, idx + 1);
      if (toRevoke) URL.revokeObjectURL(toRevoke);
      return prev.filter((_, i) => i !== idx);
    });
  }

  useEffect(() => {
    return () => {
      previews.forEach((url) => url && URL.revokeObjectURL(url));
    };
  }, [previews]);

  useEffect(() => {
    function onQuoteFromForum(evt: any) {
      const raw: string = (evt?.detail?.text ?? "").toString();
      const clean = normalizeForumText(raw);
      if (!clean) return;
      const quoted = `> _From forum:_\n` + asBlockquote(clean);
      setText(prev => (prev ? prev + "\n\n" : "") + quoted + "\n\n");
      setTimeout(() => textareaRef.current?.focus(), 0);
    }
    window.addEventListener("discussion:quote-for-chat", onQuoteFromForum as any);
    return () => window.removeEventListener("discussion:quote-for-chat", onQuoteFromForum as any);
  }, []);

  // function onFilesSelected(list: FileList | null) {
  //   if (!list) return;
  //   setFiles((prev) => [...prev, ...Array.from(list)]);
  // }

  // function removeFile(idx: number) {
  //   setFiles((prev) => prev.filter((_, i) => i !== idx));
  // }

  // read quote draft from store


  async function hydrateAndAppendById(messageId: string, driftId?: string | null) {
    try {
      const r = await fetch(
        `/api/sheaf/messages?userId=${encodeURIComponent(String(currentUserId))}&messageId=${encodeURIComponent(messageId)}`,
        { cache: "no-store" }
      );
      const data = await r.json();
      const hydrated = data?.messages?.[0] ?? data?.message ?? null;
      if (!hydrated) return;
      if (hydrated.driftId || driftId) {
        // route to drift pane
        useChatStore.getState().appendDriftMessage(hydrated.driftId ?? String(driftId), hydrated);
      } else {
        // main timeline
        useChatStore.getState().appendMessage(conversationId, hydrated);
      }
    } catch (e) {
      console.warn("[Drift] hydrate after send failed", e);
    }
  }
  useEffect(() => {
    const key = `dq:conv:${String(conversationId)}`;
    try {
      const raw = sessionStorage.getItem(key);
      if (raw) {
        const { text: q } = JSON.parse(raw) as { text?: string };
        const clean = normalizeForumText(q ?? "");
        if (clean) {
          const quoted = `> _From forum:_\n` + asBlockquote(clean);
          setText(prev => (prev ? prev + "\n\n" : "") + quoted + "\n\n");
          setTimeout(() => textareaRef.current?.focus(), 0);
        }
        sessionStorage.removeItem(key);
      }
    } catch {}
  }, [conversationId]);
  
 const quoteDraft = useChatStore(
     useCallback((s) => s.quoteDraftByConversationId[conversationId], [conversationId])
   );
   const setQuoteDraft = useChatStore((s) => s.setQuoteDraft);
   const clearQuoteDraft = useCallback(() => setQuoteDraft(conversationId, undefined), [conversationId, setQuoteDraft]);

  async function send() {

    if (uploading) return;
    if (!text.trim() && files.length === 0 && !quoteDraft) return; // allow “quote only”
        const clientId = crypto.randomUUID();
    const form = new FormData();
    if (text.trim()) form.append("text", text);
  
    if (driftId) form.append("driftId", driftId); // ← tag to a drift
    if (quoteDraft) console.log("sending meta", { quotes: [{ sourceMessageId: quoteDraft.messageId, sourceFacetId: quoteDraft.facetId ?? null }]});
    if (quoteDraft) {
           // Use set() so there is exactly one meta value
           form.set(
             "meta",
             JSON.stringify({
              quotes: [
                 {
                   sourceMessageId: quoteDraft.messageId,
                   sourceFacetId: quoteDraft.facetId ?? null,
                 },
               ],
             })
           );
         }
    files.forEach((f) => form.append("files", f));
    form.append("clientId", clientId);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/messages/${conversationId}`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        setProgress((e.loaded / e.total) * 100);
      }
    };
    xhr.onload = () => {
      try {
        if (xhr.status < 200 || xhr.status >= 300)
          throw new Error("Upload failed");
             // Parse the minimal DTO returned by POST /api/messages/:id
             const resp = JSON.parse(xhr.responseText);
             const mid = String(resp?.id ?? "");
             const did = resp?.driftId ? String(resp.driftId) : (driftId ? String(driftId) : null);
             if (mid) {
               // Immediately rehydrate + append to the correct place (pane or main)
               hydrateAndAppendById(mid, did ?? undefined);
             }
       
      } catch (e) {
        // TODO: surface error toast
      } finally {
        setText("");
        setFiles([]);
        clearQuoteDraft();        
        setUploading(false);
        setProgress(0);
      }
    };
    xhr.onerror = () => {
      setUploading(false);
      setProgress(0);
      // TODO: toast
    };
    setUploading(true);
    xhr.send(form);
  }
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (uploading) return;
    // reuse your existing send() logic
    send();
  }

  // helper: create a plain text message and return its id    normalized DTO for local append
  async function createQuestionMessage(question: string) {
    const fd = new FormData();
    fd.set("text", question);
    const res = await fetch(`/api/messages/${conversationId}`, {
      method: "POST",
      body: fd,
    });
    if (!res.ok) throw new Error("Failed to create message");
    const data = await res.json();
    const msg = {
      id: data.id,
      text: data.text,
      createdAt: data.createdAt,
      senderId: data.senderId,
      sender: data.sender,
      attachments: data.attachments || [],
      driftId: data.driftId || null,
      isRedacted: data.isRedacted || false,
    };
    appendMessage(conversationId, msg);
    return msg;
  }

  async function createOptionsPoll(question: string, options: string[]) {
    const msg = await createQuestionMessage(question);
    const res = await fetch("/api/polls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        conversationId,
        messageId: msg.id,
        kind: "OPTIONS",
        options,
      }),
    });
    const data = await res.json();
    if (!res.ok || !data?.ok)
      throw new Error(data?.error || "Failed to create poll");
    // broadcast so everyone renders the chip under this message
    supabase.channel(`conversation-${conversationId}`).send({
      type: "broadcast",
      event: "poll_create",
      payload: { poll: data.poll, state: null, my: null },
    });
  }

  async function createTempCheck(question: string) {
    const msg = await createQuestionMessage(question);
    const res = await fetch("/api/polls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        conversationId,
        messageId: msg.id,
        kind: "TEMP",
      }),
    });
    const data = await res.json();
    if (!res.ok || !data?.ok)
      throw new Error(data?.error || "Failed to create temperature check");
    supabase.channel(`conversation-${conversationId}`).send({
      type: "broadcast",
      event: "poll_create",
      payload: { poll: data.poll, state: null, my: null },
    });
  }
  async function refreshAndAppendSheaf(messageId: string) {
    try {
      const res = await fetch(
        `/api/sheaf/messages?userId=${currentUserId}&conversationId=${conversationId}`
      );
      if (!res.ok) return;
      const data = await res.json();
      // data: { userId, messages: [...] }
      const found = (data?.messages || []).find(
        (m: any) => String(m.id) === String(messageId)
      );
      if (found) {
        appendMessage(conversationId, found);
      }
    } catch (e) {
      // non-fatal
      console.warn("[Sheaf] append fallback failed", e);
    }
  }

  return (
    <div
      className="relative"
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        setDragOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        onFilesSelected(e.dataTransfer.files);
      }}
    >
  {/* Quote pill (if quoting) */}
      {quoteDraft && (
       <div className="mb-2 mx-1 max-w-[720px] text-xs text-slate-600 flex items-center gap-2">
         <span>
           Quoting #{quoteDraft.messageId}
           {quoteDraft.facetId ? ` · facet ${quoteDraft.facetId}` : ""}
         </span>
         <button
           type="button"
           className="px-2 py-0.5 border rounded bg-white/80 hover:bg-white"
           onClick={clearQuoteDraft}
         >
           Clear
         </button>
       </div>
     )}
      {dragOver && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/50 text-white border-2 border-dashed rounded-md">
          Drop files here
        </div>
      )}

      <div className="space-y-2">
        {files.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {files.map((file, i) => {
              const isImg = file.type.startsWith("image/");
              ///const url = isImg ? URL.createObjectURL(file) : undefined;
              const url = isImg ? previews[i] : undefined;
              return (
                <div
                  key={i}
                  className="relative w-20 h-20 border rounded-md overflow-hidden"
                >
                  {isImg ? (
                    <Image
                      src={url!}
                      alt={file.name}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex items-center justify-center w-full h-full bg-gray-100">
                      <FileIcon className="w-8 h-8" />
                    </div>
                  )}
                  <button
                    type="button"
                    className="absolute top-0 right-0 bg-black/50 text-white rounded-bl p-1"
                    onClick={() => removeFile(i)}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
        <form
          onSubmit={handleSubmit}
          className="relative"
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            setDragOver(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            onFilesSelected(e.dataTransfer.files);
          }}
        >
          <div className="flex flex-1 w-full  align-center  gap-3">
            
            <>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="flex bg-white/70 sendbutton h-fit w-fit text-black tracking-widest text-[1.1rem] rounded-xl px-4 py-2"
                    title="Create"
                  >
                    <Image
                src="/assets/layers--external.svg"
                alt="share"
                width={24}
                height={24}
                className="cursor-pointer object-contain flex  justify-center items-center "
              />
                  
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="flex flex-col flex-1 bg-white/30 backdrop-blur rounded-xl min-w-[200px] max-w-[400px] py-2 max-h-[500px] w-full gap-1
                h-full text-[1rem] tracking-wide" align="start" sideOffset={6}>
                  <DropdownMenuItem className="rounded-xl  w-full" onClick={() => setShowPoll(true)}>
                    <div className="flex  w-full gap-1">
                  <p className="flex justify-start text-start">𒆝</p>  
                  <p className="flex justify-center items-center text-center"> Create Poll</p> 
                  </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem className="rounded-xl w-full" onClick={() => setShowTemp(true)}>
                  <div className="flex  w-full gap-1">
                  <p className="flex justify-start text-start">𒋲</p>  
                  <p className="flex justify-center items-center text-center"> Temp Check</p> 
                  </div>

                  </DropdownMenuItem>
                  <DropdownMenuItem
                     className="rounded-xl w-full"
                     onClick={async () => {
                       const title = prompt("Drift title");
                       if (!title) return;
                       try {
                        const res = await fetch("/api/drifts", {
                             method: "POST",
                             headers: { "Content-Type": "application/json" },
                             body: JSON.stringify({ conversationId, title }),
                          });
                           if (!res.ok) throw new Error(await res.text());
                           const data = await res.json();
                           const { anchor, drift } = data;
                           // 1) insert anchor into the main timeline
                           useChatStore.getState().appendMessage(String(conversationId), anchor);
                           // 2) upsert drift metadata for the chip
                           useChatStore.getState().upsertDrift({
                             drift,
                             my: { collapsed: true, pinned: false, muted: false, lastReadAt: null }
                          });
                          
                       } catch (e: any) {
                         alert(e?.message ?? "Failed to create drift");
                       }
                     }}
                   >
                            <div className="flex  w-full gap-1">
                  <p className="flex justify-start text-start">𒂝 </p>  
                  <p className="flex justify-center items-center text-center">  Create Drift</p> 
                  </div>
                   </DropdownMenuItem>
                  {/* ✅ NEW: toggle Sheaf panel */}
                  <DropdownMenuItem className="rounded-xl w-full" onClick={() => setShowSheaf((v) => !v)}>
                  <div className="flex  w-full gap-1">
                  <p className="flex justify-start text-start">𒒚</p>  
                  <p className="flex justify-end items-end text-center"> Stratified</p> 
                  </div>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* ✅ NEW: Inline Sheaf panel (collapsible)
        {showSheaf && (
          <div className="mt-3 rounded-xl border bg-white/60 p-3 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium">Sheaf message</div>
              <button
                type="button"
                className="text-xs px-2 py-1 rounded bg-white/70 border"
                onClick={() => setShowSheaf(false)}
              >
                Close
              </button>
            </div>

            <SheafComposer
              threadId={conversationId}
              authorId={currentUserId}
              onSent={({ messageId }) => {
                // You can optionally fetch the message and append, or rely on realtime.
                // Close panel after successful send:
                setShowSheaf(false);
                // console.log('Sheaf sent', messageId);
              }}
              viewAsCandidates={[
                { id: "MOD", label: "Role: MOD", type: "role" },
                // add more view-as entries if needed
              ]}
            />
          </div>
        )} */}
              {/* Sheaf Modal */}
              {/* <Dialog open={showSheaf} onOpenChange={setShowSheaf}>
                <DialogContent className="flex flex-1 flex-col max-h-[90vh] max-w-3xl h-full w-full bg-slate-300 rounded-xl    ">
                  <DialogHeader >
                    <DialogTitle hidden className="py-0    my-0 tracking-wide">Create layered message</DialogTitle>
                  </DialogHeader>
                  <h1 className="text-[1.25rem] font-semibold tracking-wide py-0 my-0">Create layered message</h1>
                  <div className="mt-0">
                    <SheafComposer
                      threadId={conversationId}
                      authorId={currentUserId}
                      onSent={async ({ messageId }) => {
                        setShowSheaf(false);
                        await refreshAndAppendSheaf(messageId);
                      }}
                      onCancel={() => setShowSheaf(false)}
                      viewAsCandidates={[
                        { id: "MOD", label: "Role: MOD", type: "role" },
                      ]}
                    />
                  </div>
                </DialogContent>
              </Dialog> */}

              <Dialog open={showSheaf} onOpenChange={setShowSheaf}>
  <DialogContent className="p-3 sheaf-shadow max-w-3xl w-full bg-white/30 rounded-xl  border-[2px] border-indigo-300
   backdrop-blur-lg">
    {/* The column wrapper needs an explicit height and min-h-0 so the middle can scroll */}
    <div className="flex  max-h-[90vh] flex-col min-h-0  bg-transparent
 rounded-xl border-none custom-scrollbar">
      {/* Header (not scrollable) */}
      <div className="shrink-0 p-4">
        <DialogHeader className="p-0  ">
          <DialogTitle className="text-xl text-slate-800 px-2 font-semibold
          py-2 tracking-wide  ">Create Stratified Message</DialogTitle>
        </DialogHeader>
        <hr className="border-white/40 "></hr>
      </div>

      {/* Body (scrollable) */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4">
        <SheafComposer
          threadId={conversationId}
          authorId={currentUserId}
          onSent={async ({ messageId }) => {
            setShowSheaf(false);
            await refreshAndAppendSheaf(messageId);
          }}
          onCancel={() => setShowSheaf(false)}
        />
      </div>

      {/* Optional footer (fixed) */}
      {/* <div className="shrink-0 p-4 border-t">
        …anything fixed at bottom…
      </div> */}
    </div>
  </DialogContent>
</Dialog>


              <QuickPollModal
                open={showPoll}
                onClose={() => setShowPoll(false)}
                onSubmit={async ({ question, options }) => {
                  try {
                    await createOptionsPoll(question, options);
                  } catch (e: any) {
                    alert(e?.message || "Failed to create poll");
                  }
                }}
              />

              <QuickTempModal
                open={showTemp}
                onClose={() => setShowTemp(false)}
                onSubmit={async ({ question }) => {
                  try {
                    await createTempCheck(question);
                  } catch (e: any) {
                    alert(e?.message || "Failed to create temperature check");
                  }
                }}
              />
            </>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              aria-label="Attach files"
              className="flex bg-white/70 sendbutton  h-fit w-fit text-black tracking-widest text-[1.1rem] rounded-xl px-3 py-2"
            >
              <input
                type="file"
                multiple
                accept="image/*,application/pdf,application/zip"
                onChange={(e) => onFilesSelected(e.target.files)}
                className="hidden"
              />
              {/* <Paperclip className="w-[24px] h-[24px]  cursor-pointer" /> */}
              <Image
                src="/assets/attachment.svg"
                alt="share"
                width={24}
                height={24}
                className="cursor-pointer object-contain flex  justify-center items-center "
              />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,application/pdf,application/zip"
              onChange={(e) => onFilesSelected(e.target.files)}
              className="hidden"
            />
            <div className="flex flex-1 w-full">
              <textarea
                ref={textareaRef}   
                className="flex flex-1 h-full w-full text-start align-center rounded-xl bg-white/70 px-4 py-3 text-[.9rem] tracking-wider  messagefield text-black"
                rows={1}
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  if (e.target.value.trim()) sendTyping(); // hook can debounce/throttle internally
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (!uploading) send();
                  }
                }}
                disabled={uploading}
              />
            </div>
            <button
              type="submit"
              className="flex bg-white/70 sendbutton h-fit w-fit text-black tracking-widest text-[1.1rem] rounded-xl px-5 py-2"
              disabled={uploading}
            >
              <Image
                src="/assets/send--alt.svg"
                alt="share"
                width={24}
                height={24}
                className="cursor-pointer object-contain"
              />
            </button>
          </div>
          {uploading && (
            <div className="h-2 bg-gray-200 rounded-full mt-5">
              <div
                className="h-full bg-indigo-300 rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

// components/chat/MessageComposer.tsx (snippet for adding realtime presence ui)
// const { sendTyping } = useConversationRealtime(conversationId, {
//   id: currentUserId,
//   name: currentUserName,
//   image: currentUserImage,
// });

// <input
//   type="text"
//   value={text}
//   onChange={(e) => {
//     setText(e.target.value);
//     if (e.target.value.trim()) sendTyping();
//   }}
//   // …
// />
