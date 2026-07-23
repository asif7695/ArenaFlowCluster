"use client";
import { useDash } from "@/lib/store";
import Landing from "./Landing";
import Boot from "./Boot";
import Sidebar from "./Sidebar";
import Header from "./Header";
import StatBar from "./StatBar";
import Overview from "./views/Overview";
import NodeInspector from "./views/NodeInspector";
import Forecast from "./views/Forecast";
import Compare from "./views/Compare";
import CostAnalytics from "./views/CostAnalytics";
import Alerts from "./views/Alerts";
import DecisionLog from "./views/DecisionLog";

export default function Shell() {
  const { view, phase } = useDash();

  // front page -> boot sequence -> dashboard
  if (phase === "landing") return <Landing />;
  if (phase === "boot") return <Boot />;

  return (
    <div style={{ display: "flex", height: "100vh", width: "100%", overflow: "hidden" }}>
      <Sidebar />
      <main style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <Header />
        <StatBar />
        <div className="scrolly" style={{ flex: 1, padding: 22 }}>
          {view === "overview" && <Overview />}
          {view === "node" && <NodeInspector />}
          {view === "forecast" && <Forecast />}
          {view === "compare" && <Compare />}
          {view === "cost" && <CostAnalytics />}
          {view === "alerts" && <Alerts />}
          {view === "decisions" && <DecisionLog />}
        </div>
      </main>
    </div>
  );
}
