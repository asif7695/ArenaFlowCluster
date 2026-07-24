"use client";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import StatBar from "@/components/StatBar";

// Persistent chrome shared by every dashboard route (/overview, /node/[id],
// /forecast, /compare, /cost, /alerts, /decisions) — only `children` (the
// routed page) changes between them.
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", height: "100vh", width: "100%", overflow: "hidden" }}>
      <Sidebar />
      <main style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <Header />
        <StatBar />
        <div className="scrolly" style={{ flex: 1, padding: 22 }}>
          {children}
        </div>
      </main>
    </div>
  );
}
