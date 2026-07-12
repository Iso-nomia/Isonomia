import CursorSVG from "@/public/assets/CursorSVG";

type Props = {
  color: string;
  x: number;
  y: number;
  username: string;
};

const Cursor = ({ color, x, y, username }: Props) => (
  <div
    className="pointer-events-none absolute left-0 top-0"
    style={{ transform: `translateX(${x}px) translateY(${y}px)` }}
  >
    <CursorSVG color={color} />

    <div
      className="absolute left-2 top-5 flex items-center gap-1 rounded-4xl px-2"
      style={{ backgroundColor: color, borderRadius: 40 }}
    >
      <div className="h-4 w-4 flex items-center justify-center rounded-full bg-white text-black text-xs">
        {username.charAt(0).toUpperCase()}
      </div>
      <p className="whitespace-nowrap text-sm leading-relaxed text-white">
        {username}
      </p>
    </div>
  </div>
);

export default Cursor;
