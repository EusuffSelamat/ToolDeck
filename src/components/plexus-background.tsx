"use client";

import { useMemo } from "react";

/**
 * Fixed full-viewport plexus/constellation background per §10:
 * thin teal lines + node dots at 4–6% opacity, kept toward edges and corners.
 * pointer-events:none, sits behind all content.
 */
export function PlexusBackground() {
  const { nodes, lines } = useMemo(() => buildPlexus(), []);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      style={{ backgroundColor: "var(--color-bg-0)" }}
    >
      {/* subtle radial vignette toward the teal-deep core */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 80% at 50% 0%, rgba(14,79,74,0.35) 0%, rgba(3,10,10,0) 60%)",
        }}
      />
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 400 800"
        preserveAspectRatio="xMidYMid slice"
        style={{ opacity: 0.06 }}
      >
        {lines.map((l, i) => (
          <line
            key={i}
            x1={l.x1}
            y1={l.y1}
            x2={l.x2}
            y2={l.y2}
            stroke="#19E3C4"
            strokeWidth="0.6"
          />
        ))}
        {nodes.map((n, i) => (
          <circle
            key={i}
            cx={n.x}
            cy={n.y}
            r={n.r}
            fill="#6BFFE9"
          />
        ))}
      </svg>
      {/* top + bottom fade so the plexus never crowds dense content */}
      <div
        className="absolute inset-x-0 top-0 h-40"
        style={{ background: "linear-gradient(to bottom, var(--color-bg-0), transparent)" }}
      />
      <div
        className="absolute inset-x-0 bottom-0 h-40"
        style={{ background: "linear-gradient(to top, var(--color-bg-0), transparent)" }}
      />
    </div>
  );
}

type Node = { x: number; y: number; r: number };

function buildPlexus(): { nodes: Node[]; lines: { x1: number; y1: number; x2: number; y2: number }[] } {
  // Deterministic edge-biased node field. Hand-tuned so lines hug the frame.
  const W = 400;
  const H = 800;
  const raw: Node[] = [
    { x: 20, y: 60, r: 2.4 },
    { x: 70, y: 30, r: 1.6 },
    { x: 150, y: 24, r: 2.0 },
    { x: 250, y: 18, r: 1.4 },
    { x: 330, y: 40, r: 2.2 },
    { x: 384, y: 90, r: 1.8 },
    { x: 372, y: 180, r: 2.0 },
    { x: 388, y: 300, r: 1.5 },
    { x: 364, y: 420, r: 2.2 },
    { x: 384, y: 540, r: 1.7 },
    { x: 360, y: 660, r: 2.0 },
    { x: 330, y: 760, r: 1.8 },
    { x: 240, y: 782, r: 2.2 },
    { x: 140, y: 776, r: 1.6 },
    { x: 60, y: 752, r: 2.0 },
    { x: 16, y: 690, r: 1.8 },
    { x: 24, y: 560, r: 2.2 },
    { x: 12, y: 430, r: 1.6 },
    { x: 28, y: 300, r: 2.0 },
    { x: 14, y: 180, r: 1.8 },
    { x: 200, y: 120, r: 1.4 },
    { x: 300, y: 700, r: 1.4 },
    { x: 100, y: 400, r: 1.2 },
    { x: 290, y: 240, r: 1.3 },
  ];

  // Connect nodes within a threshold distance — but only keep lines that stay
  // near the frame (avoid a dense web through the centre).
  const threshold = 150;
  const lines: { x1: number; y1: number; x2: number; y2: number }[] = [];
  for (let i = 0; i < raw.length; i++) {
    for (let j = i + 1; j < raw.length; j++) {
      const a = raw[i];
      const b = raw[j];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (d < threshold) {
        // midpoint must be near an edge to keep the web off-centre
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2;
        const edgeDist = Math.min(mx, W - mx, my, H - my);
        if (edgeDist < 110) {
          lines.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y });
        }
      }
    }
  }

  return { nodes: raw, lines };
}
