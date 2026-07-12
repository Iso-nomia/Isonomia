"use client";

import { useCallback, useEffect, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import { Image as ExtImage } from "@tiptap/extension-image";
import StarterKit from "@tiptap/starter-kit";
import styles from "./article.module.scss";
import { uploadFileToSupabase } from "@/lib/utils";
import HeroRenderer from "./HeroRenderer";

interface EditorProps {
  articleId: string;
}

export default function Editor({ articleId }: EditorProps) {
  const [template, setTemplate] = useState("standard");
  const [heroImageKey, setHeroImageKey] = useState<string | null>(null);
  const [heroPreview, setHeroPreview] = useState<string | null>(null);

  const editor = useEditor({
    extensions: [StarterKit, ExtImage],
    content: "",
  });

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/articles/${articleId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.astJson && editor) {
          editor.commands.setContent(data.astJson);
        }
        if (data.template) setTemplate(data.template);
        if (data.heroImageKey) {
          setHeroImageKey(data.heroImageKey);
          setHeroPreview(data.heroImageKey);
        }
      }
    }
    load();
  }, [articleId, editor]);

  const saveDraft = useCallback(async () => {
    if (!editor) return;
    const body = {
      astJson: editor.getJSON(),
      template,
      heroImageKey,
    };
    await fetch(`/api/articles/${articleId}/draft`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }, [editor, articleId, template, heroImageKey]);

  useEffect(() => {
    if (!editor) return;
    let timeout: NodeJS.Timeout;
    const handler = () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => saveDraft(), 1000);
    };
    editor.on("update", handler);
    return () => {
      editor.off("update", handler);
      clearTimeout(timeout);
    };
  }, [editor, saveDraft]);

  useEffect(() => {
    saveDraft();
  }, [template, heroImageKey, saveDraft]);

  const onImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file || !editor) return;
    const { fileURL } = await uploadFileToSupabase(file);
    if (fileURL) {
      editor.chain().focus().setImage({ src: fileURL }).run();
    }
    e.target.value = "";
  };

  const onHeroUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const res = await fetch(
      `/api/articles/presign?filename=${encodeURIComponent(
        file.name,
      )}&contentType=${encodeURIComponent(file.type)}`,
    );
    const { uploadUrl } = await res.json();
    await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type },
      body: file,
    });
    const publicUrl = uploadUrl.split("?")[0];
    setHeroImageKey(publicUrl);
    setHeroPreview(publicUrl);
    e.target.value = "";
  };

  return (
    <div className={`${styles.article}`}>
      <div className={styles.controls}>
        {/* <label>
          Template:
          <select
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
          >
            <option value="standard">Standard</option>
            <option value="feature">Feature</option>
            <option value="interview">Interview</option>
          </select>
        </label> */}
        <div className="gap-4 mx-4 p-2">
        {/* <button className="savebutton bg-white w-[200px]">
        <input type="file" onChange={onImageUpload} />
        </button> */}
        {/* <button className="savebutton bg-white w-[200px]">

        <input type="file" onChange={onHeroUpload} />
        </button> */}
        </div>
      </div>
      {heroPreview && <HeroRenderer src={heroPreview} template={template} />}
      <EditorContent editor={editor}
        className=" flex-1 h-max-[1500px] w-full px-0 py-0 overflow-auto border-none outline-none  rounded-xl"
        />
    </div>   
  );
}
