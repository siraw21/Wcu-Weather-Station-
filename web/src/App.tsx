import React, { lazy, Suspense, useEffect } from "react";
import { BrowserRouter, Navigate, NavLink, Route, Routes } from "react-router-dom";
import { BrandMark } from "./components/BrandMark";
import { Dashboard } from "./pages/Dashboard";
import { LiveProvider, useLive } from "./lib/live";
import { BRAND, sceneColors } from "./theme";

// Charts are only needed on the History page, so load them on demand.
const History = lazy(() => import("./pages/History").then((m) => ({ default: m.History })));

const Shell: React.FC = () => {
  const { reading, online, wsState } = useLive();
  const tempC = reading?.temperatureC ?? null;

  // The page background shifts from cool blue to warm amber with the live temperature.
  useEffect(() => {
    const { top, bottom } = sceneColors(tempC);
    const root = document.documentElement.style;
    root.setProperty("--bg-top", top);
    root.setProperty("--bg-bottom", bottom);
  }, [tempC]);

  const statusLabel = online ? "Online" : wsState === "reconnecting" ? "Reconnecting" : "Offline";

  return (
    <div className="layout">
      <header className="topbar">
        <div className="brand">
          <BrandMark size={46} />
          <div className="brand-text">
            <span className="brand-eyebrow">{BRAND.university}</span>
            <span className="brand-title">{BRAND.product}</span>
          </div>
        </div>

        <nav className="nav glass" aria-label="Main">
          <NavLink to="/dashboard">Dashboard</NavLink>
          <NavLink to="/history">History</NavLink>
        </nav>

        <span className={`status glass ${online ? "online" : ""}`} role="status">
          <span className="status-dot" />
          {statusLabel}
        </span>
      </header>

      <main>
        <Suspense fallback={<div className="glass empty-state">Loading…</div>}>
          <Routes>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/history" element={<History />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Suspense>
      </main>

      <footer className="footer">
        <span>{BRAND.full}</span>
        <span>ESP32 · DHT11 · BMP280</span>
      </footer>
    </div>
  );
};

export const App: React.FC = () => (
  <BrowserRouter>
    <LiveProvider>
      <Shell />
    </LiveProvider>
  </BrowserRouter>
);

export default App;
