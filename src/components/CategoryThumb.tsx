import { SafeImage } from "./SafeImage";

/**
 * A category's picture from the ERP, sized by `className` (`cat-chip-thumb`,
 * `dc-thumb`, `cat-subdrop-thumb`). Nothing renders when there is none.
 */
export function CategoryThumb({ src, className }: { src: string | undefined; className: string }) {
  if (!src) return null;
  return (
    <span className={`${className} thumb-box`}>
      <SafeImage src={src} alt="" sizes="48px" fallbackSize={16} />
    </span>
  );
}
