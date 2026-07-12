interface Heading {
  level: number;
  text: string;
  id: string;
}

interface OutlineProps {
  headings: Heading[];
  onSelect: (id: string) => void;
}

export default function Outline({ headings, onSelect }: OutlineProps) {
  if (!headings.length) return null;
  return (
    <nav>
      {headings.map((h) => (
        <div key={h.id} style={{ marginLeft: (h.level - 1) * 12 }}>
          <button onClick={() => onSelect(h.id)}>{h.text}</button>
        </div>
      ))}
    </nav>
  );
}
