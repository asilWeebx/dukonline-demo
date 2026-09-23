"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { useDialogA11y } from "@/lib/dialog";

import { IX, IZoomIn, IZoomOut } from "./icons";

const ZOOM_MIN = 1;
const ZOOM_MAX = 6;

const clampZoom = (z: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));

/** Full-screen product photo with keyboard, mouse-wheel, pinch and drag zoom. */
export function ImgLightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dialogRef = useDialogA11y(true, onClose);
  const stageRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef<{ sx: number; sy: number; px: number; py: number } | null>(null);
  const pinchStart = useRef<{ d: number; z: number; p: { x: number; y: number } } | null>(null);

  const reset = () => {
    setZoom(1);
    setPos({ x: 0, y: 0 });
  };
  /** A screen point relative to the stage centre. */
  const rel = (cx: number, cy: number) => {
    const r = stageRef.current!.getBoundingClientRect();
    return { x: cx - (r.left + r.width / 2), y: cy - (r.top + r.height / 2) };
  };
  /** Zooms by `factor`, keeping the point under the cursor in place. */
  const zoomAt = (cx: number, cy: number, factor: number) => {
    const nz = clampZoom(zoom * factor);
    if (nz === zoom) return;
    if (nz === ZOOM_MIN) {
      reset();
      return;
    }
    const c = rel(cx, cy);
    const k = nz / zoom;
    setPos({ x: c.x - (c.x - pos.x) * k, y: c.y - (c.y - pos.y) * k });
    setZoom(nz);
  };
  const step = (dir: 1 | -1) =>
    zoomAt(window.innerWidth / 2, window.innerHeight / 2, dir > 0 ? 1.45 : 1 / 1.45);

  // Non-passive listeners (React's wheel/touch handlers are passive), re-bound
  // every render so they always see the current zoom and position.
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      zoomAt(event.clientX, event.clientY, event.deltaY < 0 ? 1.15 : 1 / 1.15);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  });

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const dist = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    const start = (event: TouchEvent) => {
      if (event.touches.length === 2) pinchStart.current = { d: dist(event.touches), z: zoom, p: { ...pos } };
    };
    const move = (event: TouchEvent) => {
      if (event.touches.length !== 2 || !pinchStart.current) return;
      event.preventDefault();
      const s = pinchStart.current;
      const nz = clampZoom((s.z * dist(event.touches)) / s.d);
      const cx = (event.touches[0].clientX + event.touches[1].clientX) / 2;
      const cy = (event.touches[0].clientY + event.touches[1].clientY) / 2;
      const c = rel(cx, cy);
      const k = nz / s.z;
      setPos({ x: c.x - (c.x - s.p.x) * k, y: c.y - (c.y - s.p.y) * k });
      setZoom(nz);
    };
    const end = () => {
      pinchStart.current = null;
    };
    el.addEventListener("touchstart", start, { passive: true });
    el.addEventListener("touchmove", move, { passive: false });
    el.addEventListener("touchend", end);
    el.addEventListener("touchcancel", end);
    return () => {
      el.removeEventListener("touchstart", start);
      el.removeEventListener("touchmove", move);
      el.removeEventListener("touchend", end);
      el.removeEventListener("touchcancel", end);
    };
  });

  const onDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (zoom <= 1) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragStart.current = { sx: event.clientX, sy: event.clientY, px: pos.x, py: pos.y };
    setDragging(true);
  };
  const onMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const d = dragStart.current;
    if (!d) return;
    setPos({ x: d.px + event.clientX - d.sx, y: d.py + event.clientY - d.sy });
  };
  const onUp = () => {
    dragStart.current = null;
    setDragging(false);
  };

  return createPortal(
    <div
      ref={dialogRef}
      className="lb-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="lightbox-title"
      tabIndex={-1}
      onClick={(event) => {
        event.stopPropagation();
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="lb-top">
        <div className="lb-title" id="lightbox-title">
          {alt || "Mahsulot rasmi"}
        </div>
        <div className="lb-actions">
          <button type="button" className="lb-btn" aria-label="Kichraytirish" onClick={() => step(-1)} disabled={zoom <= ZOOM_MIN}>
            <IZoomOut s={18} />
          </button>
          <button type="button" className="lb-zoom-label" aria-label="Boshlang‘ich o‘lchamga qaytarish" onClick={reset}>
            {Math.round(zoom * 100)}%
          </button>
          <button type="button" className="lb-btn" aria-label="Kattalashtirish" onClick={() => step(1)} disabled={zoom >= ZOOM_MAX}>
            <IZoomIn s={18} />
          </button>
          <button type="button" className="lb-btn" aria-label="Yopish" onClick={onClose}>
            <IX s={17} />
          </button>
        </div>
      </div>
      <div
        ref={stageRef}
        className={`lb-stage${zoom > 1 ? " zoomed" : ""}${dragging ? " dragging" : ""}`}
        onClick={(event) => {
          event.stopPropagation();
          if (zoom === 1 && event.target === stageRef.current) onClose();
        }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onDoubleClick={(event) => (zoom > 1 ? reset() : zoomAt(event.clientX, event.clientY, 2.5 / zoom))}
      >
        {/* A plain <img>: the lightbox shows the original at its natural size. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className={dragging ? "no-anim" : ""}
          src={src}
          alt={alt}
          draggable={false}
          style={{ transform: `translate(${pos.x}px, ${pos.y}px) scale(${zoom})` }}
        />
      </div>
      <div className="lb-bottom">
        Ikki marta bosing yoki g‘ildirak bilan kattalashtiring · Zoom holatda sudrang · ESC — yopish
      </div>
    </div>,
    document.body,
  );
}
