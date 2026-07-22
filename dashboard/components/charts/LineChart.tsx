"use client";
// Chart.js wrapper for the large charts (forecast, cost comparison, savings).
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement,
  Filler, Tooltip, Legend,
} from "chart.js";
import { Line } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

export interface Series {
  label: string;
  data: (number | null)[];
  color: string;
  dashed?: boolean;
  fill?: string;
}

export default function LineChart({
  labels, series, height = 240, yMax,
}: { labels: (string | number)[]; series: Series[]; height?: number; yMax?: number }) {
  const data = {
    labels,
    datasets: series.map((s) => ({
      label: s.label,
      data: s.data,
      borderColor: s.color,
      backgroundColor: s.fill || "transparent",
      fill: !!s.fill,
      borderDash: s.dashed ? [6, 5] : [],
      borderWidth: 2,
      pointRadius: 0,
      tension: 0.25,
      spanGaps: true,
    })),
  };
  const options: any = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { intersect: false, mode: "index" },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: "#0d0f13",
        borderColor: "rgba(255,255,255,.1)",
        borderWidth: 1,
        titleColor: "#c9ccd1",
        bodyColor: "#e7e9ec",
        titleFont: { family: "var(--font-mono), monospace", size: 10 },
        bodyFont: { family: "var(--font-mono), monospace", size: 11 },
      },
    },
    scales: {
      x: {
        grid: { color: "rgba(255,255,255,.04)" },
        ticks: { color: "#565c66", font: { size: 9 }, maxTicksLimit: 8 },
      },
      y: {
        grid: { color: "rgba(255,255,255,.05)" },
        ticks: { color: "#565c66", font: { size: 9 } },
        suggestedMax: yMax,
        beginAtZero: true,
      },
    },
  };
  return (
    <div style={{ height }}>
      <Line data={data} options={options} />
    </div>
  );
}
