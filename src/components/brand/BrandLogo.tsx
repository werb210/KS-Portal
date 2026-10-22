// KS_PORTAL_v2_BRANDING - the licensee's logo (licensee.logo_url) or, when none is set, the first letter of the
// company name in a rounded square of the licensee's primary colour. Replaces the Boreal mountains mark.
import type { CSSProperties } from "react";
import { brandInitial, useBrand } from "@/config/brand";

/** Black or white, whichever reads better on the given hex background. */
export function readableTextOn(bg: string): string {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(bg.trim());
  const raw = m?.[1];
  if (!raw) return "#ffffff";
  const hex = raw.length === 3 ? raw.split("").map((c) => c + c).join("") : raw;
  const lin = (i: number): number => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const [r, g, b] = [lin(0), lin(2), lin(4)];
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum > 0.4 ? "#0f172a" : "#ffffff";
}

type Props = { height?: number; style?: CSSProperties; className?: string; alt?: string };

export default function BrandLogo({ height = 40, style, className, alt }: Props) {
  const brand = useBrand();
  const label = alt ?? brand.company_name;
  if (brand.logo_url) {
    return <img src={brand.logo_url} alt={label} className={className} style={{ height, width: "auto", display: "block", ...style }} />;
  }
  return (
    <span
      role="img"
      aria-label={label}
      data-testid="brand-initial"
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        height,
        width: height,
        borderRadius: Math.round(height * 0.22),
        background: brand.primary_color,
        color: readableTextOn(brand.primary_color),
        fontWeight: 700,
        fontSize: Math.round(height * 0.5),
        lineHeight: 1,
        flexShrink: 0,
        boxShadow: "0 0 0 1px rgba(255,255,255,0.25)",
        ...style,
      }}
    >
      {brandInitial()}
    </span>
  );
}
