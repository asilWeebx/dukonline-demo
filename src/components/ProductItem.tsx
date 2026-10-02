"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { FiCheck } from "react-icons/fi";

import { animateToCart } from "@/lib/cart/animate-cart";
import { useCart } from "@/lib/cart/CartProvider";
import { unitKey } from "@/lib/cart/lines";
import { fmtQty, isWeightUnit } from "@/lib/storefront/currency";
import {
  cheapestVariant,
  firstAvailableUnit,
  getPhone,
  hasVariantPhotos,
  hasVariants,
  unitMaxQty,
  variantImage,
} from "@/lib/storefront/product-view";
import type { Product } from "@/lib/storefront/types";

import { IBox, ICaret, IZoomIn } from "./icons";
import { ImgLightbox } from "./ImgLightbox";
import { PriceTag } from "./PriceTag";
import { QuantityInput } from "./QuantityInput";
import { isRenderableImageUrl, SafeImage } from "./SafeImage";

/** Grid columns: 2 → 3 → 4 → 5, see `.product-grid`. Five across a 1400px
 *  container with a 16px gap lands each card at roughly 265px. */
const CARD_SIZES =
  "(max-width: 639px) 50vw, (max-width: 767px) 33vw, (max-width: 1023px) 25vw, 265px";

/** At or below this the stock count reads as a nudge instead of a fact. */
const LOW_STOCK = 5;

/** Variant photos shown over a card's image before the rest collapse into "+N". */
const VARIANT_DOTS = 4;

export function ProductItem({
  p,
  showImages,
  eager = false,
}: {
  p: Product;
  showImages: boolean;
  /** First cards on screen: load the photo at once, it is the largest paint. */
  eager?: boolean;
}) {
  const router = useRouter();
  const { items: cart, addUnit, setQty } = useCart();
  const variants = hasVariants(p);

  const [unitId, setUnitId] = useState(firstAvailableUnit(p)?.unit_id ?? null);
  const [added, setAdded] = useState(false);
  const [zoomOpen, setZoomOpen] = useState(false);
  const [failedImage, setFailedImage] = useState<string | null>(null);
  /** The variant whose photo dot is hovered or focused: the card previews it. */
  const [previewId, setPreviewId] = useState<number | null>(null);
  const addBtnRef = useRef<HTMLButtonElement>(null);

  const href = `/product/${p.id}`;
  const openDetail = () => router.push(href);
  const preview = variants ? p.variants.find((v) => v.id === previewId) ?? null : null;
  const image = preview ? variantImage(p, preview) : p.image;
  const hasImage = showImages && isRenderableImageUrl(image) && failedImage !== image;
  const variantDots = showImages && hasVariantPhotos(p);

  const unit = !variants ? p.units?.find((u) => u.unit_id === unitId) || p.units?.[0] : null;
  const isWeight = isWeightUnit(unit?.unit_name);
  const maxQty = variants ? (p.in_stock ? 1 : 0) : unitMaxQty(p, unit);
  const cartKey = unitKey(p.id, unit);
  const inCart = !variants ? cart.find((x) => x.key === cartKey)?.qty || 0 : 0;
  const out = variants ? !p.in_stock : maxQty <= 0;

  // Each price in its own currency: USD goods in $, everything else in so'm.
  // With variants, the cheapest in stock ("dan"), or the previewed one.
  const cheapest = cheapestVariant(p);
  const first = variants ? (preview ?? cheapest?.variant) : unit;
  const dispCur = first?.currency ?? "";
  const dispVal = first?.cur_price ?? first?.price ?? 0;
  const dispOrigVal = first?.cur_original_price ?? null;

  // A phone card is the MODEL, priced from its cheapest copy. It never goes
  // straight into the cart — the configuration or copy is picked first.
  const phone = getPhone(p);

  const handleAdd = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (phone) {
      openDetail();
      return;
    }
    if (out || added || variants) return;
    addUnit(p, unit);
    animateToCart(addBtnRef.current);
    setAdded(true);
    setTimeout(() => setAdded(false), 1200);
  };

  return (
    <article className="product-item fade-up" aria-label={p.name}>
      <div className={`product-img-wrap${out ? " is-out" : ""}`}>
        {hasImage ? (
          <SafeImage
            src={image}
            alt={preview ? `${p.name} ${preview.name}` : p.name}
            sizes={CARD_SIZES}
            eager={eager}
            fallbackSize={48}
            onFail={() => setFailedImage(image)}
          />
        ) : (
          <div className="image-fallback">
            <IBox s={48} />
            <span className="sr-only">Rasm mavjud emas</span>
          </div>
        )}
        <Link href={href} className="product-image-open" aria-label={`${p.name} tafsilotlarini ochish`} />
        {hasImage && (
          <button
            type="button"
            className="card-zoom-btn"
            aria-label={`${p.name} rasmini kattalashtirish`}
            onClick={(event) => {
              event.stopPropagation();
              setZoomOpen(true);
            }}
          >
            <IZoomIn s={15} />
          </button>
        )}
        {variantDots && !out && (
          <div className="pv-dots" onMouseLeave={() => setPreviewId(null)}>
            {p.variants.slice(0, VARIANT_DOTS).map((v) => (
              <Link
                key={v.id}
                href={`${href}?v=${v.id}`}
                className={`pv-dot${previewId === v.id ? " active" : ""}${v.in_stock ? "" : " unavailable"}`}
                aria-label={`${p.name}, ${v.name}`}
                title={v.name}
                onMouseEnter={() => setPreviewId(v.id)}
                onFocus={() => setPreviewId(v.id)}
                onBlur={() => setPreviewId(null)}
              >
                <SafeImage src={variantImage(p, v)} alt="" sizes="52px" fallbackSize={12} />
              </Link>
            ))}
            {p.variants.length > VARIANT_DOTS && (
              <span className="pv-more">+{p.variants.length - VARIANT_DOTS}</span>
            )}
          </div>
        )}
        {out && (
          <div className="stock-out-overlay">
            <span className="stock-out-tag">Tugadi</span>
          </div>
        )}
        {inCart > 0 && <div className="in-cart-dot">{fmtQty(inCart)}</div>}
      </div>

      <div className="product-body">
        <Link href={href} className="product-title-btn">
          <span className="product-name clamp2">{p.name}</span>
        </Link>

        {phone && !out && <div className="product-meta">{p.stock} ta mavjud</div>}
        {!phone && !variants && p.stock_type === "tracked" && !out && (
          // Below the threshold this turns into a nudge rather than a plain count.
          <div className={`product-meta${maxQty <= LOW_STOCK ? " product-meta-low" : ""}`}>
            {maxQty <= LOW_STOCK
              ? `Oxirgi ${fmtQty(maxQty)} ${unit?.unit_name || "dona"}`
              : `${maxQty} ${unit?.unit_name || "dona"} mavjud`}
          </div>
        )}
        {out && (
          <div className="product-meta product-meta-out">Sotib bo&apos;lindi</div>
        )}
        {!phone && variants && !out && (
          <div className="product-meta">{p.variants.filter((v) => v.in_stock).length} variant mavjud</div>
        )}

        {phone ? (
          <PriceTag
            amount={phone.from_cur_price ?? phone.from_price}
            currency={phone.currency ?? ""}
            from
            discountPercent={p.discount_percent}
          />
        ) : (
          <PriceTag
            amount={dispVal}
            currency={dispCur}
            original={dispOrigVal}
            from={variants && !preview && Boolean(cheapest?.varies)}
            discountPercent={p.discount_percent}
            alt={dispCur ? (first?.price ?? null) : null}
          />
        )}

        {!phone && !variants && p.units?.length > 1 && (
          <div className="unit-row" onClick={(event) => event.stopPropagation()}>
            <span className="unit-label">Birlik:</span>
            <div className="unit-select-wrap">
              <select
                className="unit-select"
                aria-label="Birlik"
                value={unitId ?? ""}
                onChange={(event) => setUnitId(Number(event.target.value))}
              >
                {p.units.map((u) => (
                  <option key={u.unit_id ?? u.unit_name} value={u.unit_id ?? ""}>
                    {u.unit_name}
                  </option>
                ))}
              </select>
              <span className="unit-caret">
                <ICaret s={11} />
              </span>
            </div>
          </div>
        )}

        <div className="controls-row" onClick={(event) => event.stopPropagation()}>
          {variants || phone ? (
            <button
              type="button"
              className="add-btn"
              style={{ flex: 1 }}
              onClick={(event) => {
                event.stopPropagation();
                openDetail();
              }}
              disabled={out}
            >
              {out ? "Tugadi" : "Tanlang"}
            </button>
          ) : inCart > 0 ? (
            // Already in the cart: a +/− stepper that edits the cart quantity.
            <div className="qty-wrap">
              <button
                type="button"
                className="qty-btn"
                aria-label="Miqdorni kamaytirish"
                onClick={(event) => {
                  event.stopPropagation();
                  setQty(cartKey, inCart - 1);
                }}
              >
                −
              </button>
              <QuantityInput
                className="qty-num"
                value={inCart}
                max={maxQty}
                allowDecimal={isWeight}
                onCommit={(qty) => setQty(cartKey, qty)}
              />
              <button
                type="button"
                className="qty-btn"
                aria-label="Miqdorni oshirish"
                onClick={(event) => {
                  event.stopPropagation();
                  if (maxQty === Infinity || inCart < maxQty) {
                    addUnit(p, unit);
                    animateToCart(null);
                  }
                }}
              >
                +
              </button>
            </div>
          ) : (
            <button
              type="button"
              ref={addBtnRef}
              className={`add-btn${out ? " btn-tugadi" : added ? " btn-added" : ""}`}
              style={{ flex: 1 }}
              onClick={handleAdd}
              disabled={out}
            >
              {out ? "Tugadi" : added ? <FiCheck size={18} /> : "Savatga"}
            </button>
          )}
        </div>
      </div>

      {zoomOpen && hasImage && <ImgLightbox src={image} alt={p.name} onClose={() => setZoomOpen(false)} />}
    </article>
  );
}
