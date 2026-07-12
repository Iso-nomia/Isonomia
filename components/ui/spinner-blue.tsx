import { cn } from "@/lib/utils";

export default function SpinnerBlue({ className }: { className?: string }) {
  return (
    <svg
      className={cn("animate-spin h-5 w-5 text-current", className)}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth="1"

    >
      <circle
        className="opacity-50"
        cx="12"
        cy="12"
        r="12"
        stroke="#a5b4fc"
        strokeWidth="1"
      />
      <path
        className="opacity-75"
        fill="#818cf8"
        d="M 1 9 a 8 8 0 0 1 8 -8 v 4 a 4 4 0 0 0 -4 4 H 1 z"
      />
    </svg>
  );
}
