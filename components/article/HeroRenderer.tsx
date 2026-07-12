'use client';

interface HeroRendererProps {
  src?: string | null;
  template: string;
  alt?: string;
  caption?: string;
}

export default function HeroRenderer({ src, template, alt, caption }: HeroRendererProps) {
  if (!src) return null;

  if (template === "feature") {
    return (
      <figure>
        <img
          src={src}
          alt={alt ?? ""}
          className="object-cover h-[55vh] w-full lg:rounded-b-[4rem]"
        />
        {caption && <figcaption className="text-sm mt-2">{caption}</figcaption>}
      </figure>
    );
  }

  if (template === "interview") {
    return <img src={src} alt={alt ?? ""} className="w-32 h-32 rounded-full object-cover" />;
  }

  return <img src={src} alt={alt ?? ""} className="mx-auto max-w-2xl rounded-md" />;
}
