import Link from "next/link";

const HORIZONS: { key: "week" | "halfyear" | "years"; label: string }[] = [
  { key: "week", label: "One week" },
  { key: "halfyear", label: "Six months" },
  { key: "years", label: "Years" },
];

export default function HorizonNav({
  active,
}: {
  active: "week" | "halfyear" | "years";
}) {
  return (
    <nav className="flex gap-1 pt-1 font-sans text-sm">
      {HORIZONS.map((h) => {
        const isActive = h.key === active;
        return (
          <Link
            key={h.key}
            href={`/archive?horizon=${h.key}`}
            className={`rounded px-3 py-1 ${
              isActive
                ? "bg-stone-900 text-stone-50"
                : "text-stone-600 hover:bg-stone-100"
            }`}
            scroll={false}
          >
            {h.label}
          </Link>
        );
      })}
    </nav>
  );
}
