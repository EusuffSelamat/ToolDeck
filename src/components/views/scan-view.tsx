"use client";

import { useEffect, useState } from "react";
import { ScanLine, Camera, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const TIPS = [
  "Point at any tool — I'll do the rest.",
  "Good lighting helps the AI read the model.",
  "Hold steady for a sharp read.",
  "One item per shot works best.",
  "Brands and model labels boost accuracy.",
];

export function ScanView() {
  const [tip, setTip] = useState(0);
  const { toast } = useToast();

  useEffect(() => {
    const id = setInterval(() => setTip((t) => (t + 1) % TIPS.length), 3200);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex flex-col items-center px-5 pt-4">
      {/* camera viewport */}
      <div
        className="relative flex aspect-[3/4] w-full max-w-sm items-center justify-center overflow-hidden rounded-[var(--radius-card)]"
        style={{
          border: "1px solid var(--color-border)",
          background:
            "radial-gradient(120% 90% at 50% 30%, rgba(14,79,74,0.45) 0%, rgba(3,10,10,0.9) 70%)",
        }}
      >
        {/* corner brackets */}
        <Bracket className="left-4 top-4" edges={["t", "l"]} />
        <Bracket className="right-4 top-4" edges={["t", "r"]} />
        <Bracket className="bottom-4 left-4" edges={["b", "l"]} />
        <Bracket className="bottom-4 right-4" edges={["b", "r"]} />

        <div className="flex flex-col items-center gap-4 px-6 text-center">
          <span
            className="flex h-14 w-14 items-center justify-center rounded-full"
            style={{
              border: "1px solid rgba(25,227,196,0.4)",
              color: "var(--color-teal)",
            }}
          >
            <Camera size={26} />
          </span>
          <p className="micro-label">Camera viewport</p>
          <p className="text-sm" style={{ color: "var(--color-text-mid)" }}>
            Live capture arrives in Milestone 4.
          </p>
        </div>

        {/* scan line sweep decoration */}
        <div
          className="pointer-events-none absolute inset-x-8 top-1/2 h-px pulse-live"
          style={{ background: "rgba(25,227,196,0.4)" }}
        />
      </div>

      {/* rotating tip */}
      <p
        key={tip}
        className="mt-6 flex items-center gap-2 text-sm"
        style={{ color: "var(--color-text-mid)" }}
      >
        <Sparkles size={14} style={{ color: "var(--color-teal)" }} />
        {TIPS[tip]}
      </p>

      {/* shutter */}
      <button
        type="button"
        onClick={() =>
          toast({
            title: "Coming in Milestone 4",
            description: "AI snap-to-identify lands with the vision route.",
          })
        }
        className="glow-ring pulse-live mt-6 flex h-20 w-20 items-center justify-center rounded-full transition-transform active:scale-95"
        style={{
          background: "var(--color-teal)",
          color: "#04211d",
          border: "3px solid var(--color-bg-0)",
        }}
        aria-label="Capture"
      >
        <ScanLine size={30} strokeWidth={2.2} />
      </button>

      {/* last scans */}
      <div className="mt-8 w-full max-w-sm">
        <div className="mb-3 flex items-center justify-between">
          <span className="micro-label">Last scans</span>
          <span className="micro-label" style={{ color: "var(--color-text-low)" }}>
            0 of 3
          </span>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="flex aspect-square items-center justify-center rounded-2xl"
              style={{
                border: "1px dashed rgba(126,222,210,0.18)",
                color: "var(--color-text-low)",
              }}
            >
              <Camera size={18} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Bracket({
  className,
  edges,
}: {
  className: string;
  edges: ("t" | "r" | "b" | "l")[];
}) {
  const style: React.CSSProperties = {
    position: "absolute",
    width: 18,
    height: 18,
    borderColor: "var(--color-teal)",
    borderStyle: "solid",
    borderWidth: 0,
  };
  if (edges.includes("t")) style.borderTopWidth = 2;
  if (edges.includes("b")) style.borderBottomWidth = 2;
  if (edges.includes("l")) style.borderLeftWidth = 2;
  if (edges.includes("r")) style.borderRightWidth = 2;
  return <div className={className} style={style} />;
}
