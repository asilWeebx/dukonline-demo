"use client";

import { useStore } from "@/lib/storefront/StoreProvider";

/**
 * Placeholder data must never be mistakable for the real catalog. The demo
 * fallback is invisible by design — it renders a complete, plausible store — so
 * this strip is the thing that keeps it honest.
 */
export function DemoRibbon() {
  const { demo } = useStore();
  if (!demo) return null;

  return (
    <div role="status" className="demo-ribbon">
      Namuna ma&apos;lumotlari — do&apos;kon katalogi hali ulanmagan
    </div>
  );
}
