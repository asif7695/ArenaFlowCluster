"use client";
// Inline-SVG micro charts (sparkline + area) — matches the design's hand-rolled
// SVG look for small in-panel charts. Big charts use Chart.js (see LineChart).

interface SparkProps {
  values: number[];
  w?: number;
  h?: number;
  lo?: number;
  hi?: number;
  stroke?: string;
  fill?: string;
  strokeWidth?: number;
}

function path(values: number[], w: number, h: number, lo: number, hi: number): string {
  if (!values.length) return "";
  const range = hi - lo || 1;
  const step = values.length > 1 ? w / (values.length - 1) : 0;
  return values
    .map((v, i) => {
      const x = (i * step).toFixed(1);
      const y = (h - (Math.max(lo, Math.min(hi, v)) - lo) / range * h).toFixed(1);
      return `${i ? "L" : "M"}${x},${y}`;
    })
    .join(" ");
}

export default function Spark({
  values, w = 300, h = 84, lo = 0, hi = 100,
  stroke = "#ff384a", fill, strokeWidth = 1.8,
}: SparkProps) {
  const line = path(values, w, h, lo, hi);
  const area = fill && line ? `${line} L${w},${h} L0,${h} Z` : "";
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none"
         style={{ width: "100%", height: h, display: "block" }}>
      {area && <path d={area} fill={fill} />}
      <path d={line} fill="none" stroke={stroke} strokeWidth={strokeWidth} />
    </svg>
  );
}
