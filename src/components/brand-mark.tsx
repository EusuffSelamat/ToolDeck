import { cn } from "@/lib/utils";

/**
 * TOOLDECK brand mark — two-tone wordmark with a scan-frame glyph.
 * "TOOL" in text-hi, "DECK" in teal, like the reference logo.
 */
export function BrandMark({
  className,
  size = "md",
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const text =
    size === "lg" ? "text-3xl" : size === "sm" ? "text-base" : "text-xl";
  const glyph = size === "lg" ? 30 : size === "sm" ? 18 : 24;

  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <span
        className="relative inline-flex items-center justify-center rounded-md"
        style={{
          width: glyph,
          height: glyph,
          border: "1.5px solid var(--color-teal)",
          boxShadow: "0 0 14px rgba(25,227,196,0.35)",
        }}
      >
        {/* scan brackets */}
        <span
          className="absolute"
          style={{
            inset: -3,
            borderTop: "1.5px solid var(--color-teal-bright)",
            borderLeft: "1.5px solid var(--color-teal-bright)",
            width: 7,
            height: 7,
            top: -3,
            left: -3,
            borderBottom: "none",
            borderRight: "none",
          }}
        />
        <span
          className="absolute"
          style={{
            width: 7,
            height: 7,
            borderBottom: "1.5px solid var(--color-teal-bright)",
            borderRight: "1.5px solid var(--color-teal-bright)",
            bottom: -3,
            right: -3,
          }}
        />
        <span
          className="font-display font-bold"
          style={{ color: "var(--color-teal)", fontSize: glyph * 0.46 }}
        >
          T
        </span>
      </span>
      <span className={cn("font-display font-bold tracking-tight leading-none", text)}>
        <span style={{ color: "var(--color-text-hi)" }}>TOOL</span>
        <span style={{ color: "var(--color-teal)" }}>DECK</span>
      </span>
    </div>
  );
}
