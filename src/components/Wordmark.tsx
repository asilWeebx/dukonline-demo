/**
 * The shop's lockup: a mark plus the store name as real DOM text.
 *
 * Deliberately not an image or SVG-text logo — the name comes from the ERP and
 * changes per tenant, so it has to be typeset at render time. Keeping it as
 * text also means it scales with the page, stays selectable and searchable,
 * and needs no second asset for high-DPI screens.
 */
export function Wordmark({ name, size = "md" }: { name: string; size?: "md" | "lg" }) {
  const box = size === "lg" ? 26 : 20;
  return (
    <span className={`wordmark wordmark-${size}`}>
      <svg
        className="wordmark-mark"
        width={box}
        height={box}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M3 8.5 12 4l9 4.5-9 4.5-9-4.5Z" />
        <path d="M3 8.5V16l9 4.5 9-4.5V8.5" />
        <path d="M12 13v7.5" />
      </svg>
      <span className="wordmark-name">{name}</span>
    </span>
  );
}
