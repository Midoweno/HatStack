// An open brush circle — the CHI mark.
export function Enso({
  className,
  strokeWidth = 2.6,
}: {
  className?: string;
  strokeWidth?: number;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      className={className}
      aria-hidden
    >
      <path d="M19.5 7.5A9 9 0 1 0 21 12.5" />
    </svg>
  );
}
