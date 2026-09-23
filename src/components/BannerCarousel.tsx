"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { StoreBanner } from "@/lib/storefront/types";

import { SafeImage } from "./SafeImage";

interface BannerCopy {
  eyebrow?: string;
  title: string;
  description?: string;
  align: "left" | "right";
}

const BANNER_PRESETS: Array<BannerCopy & { match: string }> = [
  {
    match: "banner-fashion-lifestyle",
    eyebrow: "Yangi mavsum",
    title: "Uslubingizni yangilang",
    description: "Kiyim-kechak va kundalik aksessuarlar",
    align: "left",
  },
  {
    match: "banner-home-renovation",
    eyebrow: "Uy va ta'mir uchun",
    title: "Har bir ishga kerakli mahsulotlar",
    description: "Oshxona, qurilish va santexnika buyumlari",
    align: "left",
  },
  {
    match: "banner-mobile-technology",
    eyebrow: "Zamonaviy texnologiyalar",
    title: "Har kun uchun aqlli tanlov",
    description: "Telefonlar va foydali aksessuarlar",
    align: "right",
  },
];

/**
 * These three project banners were composed with deliberate copy space. Keep
 * backend titles authoritative, then fill only an empty title for the bundled
 * campaign artwork by recognizing its stable filename.
 */
function copyForBanner(banner: StoreBanner): BannerCopy | null {
  const title = banner.title.trim();
  if (title) return { title, align: banner.align };

  const image = banner.image.toLowerCase();
  return BANNER_PRESETS.find((preset) => image.includes(preset.match)) ?? null;
}

/** Banners from the ERP ("Online do'kon → Bannerlar"), rotating every 4 seconds. */
export function BannerCarousel({ banners }: { banners: StoreBanner[] }) {
  const [index, setIndex] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const n = banners.length;
  const current = n ? index % n : 0;

  const resume = useCallback(() => {
    clearInterval(timerRef.current);
    if (n > 1) timerRef.current = setInterval(() => setIndex((i) => (i + 1) % n), 4000);
  }, [n]);

  useEffect(() => {
    resume();
    return () => clearInterval(timerRef.current);
  }, [resume]);

  if (!n) return null;
  const go = (delta: number) => setIndex((i) => (i + delta + n) % n);

  return (
    <div className="banner-wrap">
      <div
        className="banner-viewport"
        onMouseEnter={() => clearInterval(timerRef.current)}
        onMouseLeave={resume}
      >
        <div className="banner-track" style={{ transform: `translateX(-${current * 100}%)` }}>
          {banners.map((banner, i) => {
            const copy = copyForBanner(banner);
            return (
              <div key={i} className="banner-slide">
                <SafeImage
                  src={banner.image}
                  alt={copy?.title || "Do'kon mahsulotlari"}
                  sizes="(max-width: 640px) 100vw, 1300px"
                  eager={i === 0}
                />
                {copy && (
                  <div className={`banner-copy ${copy.align}`}>
                    {copy.eyebrow && <div className="banner-eyebrow">{copy.eyebrow}</div>}
                    <div className="banner-heading">{copy.title}</div>
                    {copy.description && <div className="banner-description">{copy.description}</div>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {n > 1 && (
          <>
            <button type="button" className="banner-arrow prev" onClick={() => go(-1)} aria-label="Oldingi banner">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <button type="button" className="banner-arrow next" onClick={() => go(1)} aria-label="Keyingi banner">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
            <div className="banner-dots">
              {banners.map((_, i) => (
                <button
                  type="button"
                  key={i}
                  className={`banner-dot${i === current ? " active" : ""}`}
                  onClick={() => setIndex(i)}
                  aria-label={`Banner ${i + 1}`}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
