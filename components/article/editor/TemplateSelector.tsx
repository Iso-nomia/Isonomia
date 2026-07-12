"use client";
import styles from "../article.module.scss";
import { ARTICLE_TEMPLATES } from "../templates";

export default function TemplateSelectorPopover({
  articleId,
  template,
  onChange,
}: { articleId: string; template: string; onChange: (t: string) => void }) {
  async function apply(id: string) {
    onChange(id);
    await fetch(`/api/articles/${articleId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ template: id }),
    });
  }

  const current = ARTICLE_TEMPLATES.find((t) => t.id === template)?.label ?? "Template";

  return (
    <details className="relative">
      <summary className=" px-2 py-1 rounded-xl bg-white/50 sendbutton text-[.8rem] text-center cursor-pointer ">
        {current}
      </summary>
      <div className="absolute z-50 mt-2 min-w-[160px] rounded-md  border bg-white shadow-md">
        {ARTICLE_TEMPLATES.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`w-full px-3 py-1.5 text-left text-sm hover:bg-neutral-50 ${
              t.id === template ? "bg-neutral-100" : ""
            }`}
            onClick={() => {
              (document.activeElement as HTMLElement)?.blur();
              apply(t.id);
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
    </details>
  );
}

{/* <button           className=" px-2 py-1 rounded-xl bg-white/70 sendbutton text-[.8rem] text-center"> */}
