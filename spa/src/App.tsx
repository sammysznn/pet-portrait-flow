import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useEffect } from "react";
import type { ReactElement } from "react";
import { LandingPage } from "./pages/LandingPage";
import { OrderPage } from "./pages/OrderPage";
import { SuccessPage } from "./pages/SuccessPage";
import { AdminPage } from "./pages/AdminPage";
import { OrderStatusPage } from "./pages/OrderStatusPage";

const ROUTE_TITLES: Record<string, string> = {
  "/": "Royal Pet Portrait Studio",
  "/order": "Choose Your Portrait Styles",
  "/success": "Upload Your Pet Photo",
  "/order-status": "Track Order",
  "/admin": "Studio QA Dashboard",
};

function useDocumentTitle() {
  const location = useLocation();

  useEffect(() => {
    const direct = ROUTE_TITLES[location.pathname];
    const fallback = location.pathname.startsWith("/order-status") ? ROUTE_TITLES["/order-status"] : undefined;
    const title = direct ?? fallback ?? "Royal Pet Portrait Studio";
    document.title = title;
  }, [location.pathname]);
}

export default function App(): ReactElement {
  useDocumentTitle();

  return (
    <div className="relative min-h-screen bg-slate-950/95 text-slate-50">
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute inset-x-0 top-[-20%] mx-auto h-[60vh] max-w-5xl rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="absolute inset-x-0 bottom-[-25%] mx-auto h-[60vh] max-w-4xl rounded-full bg-emerald-400/10 blur-3xl" />
      </div>
      <main className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 pb-16 pt-10 sm:px-8 lg:px-12">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/order" element={<OrderPage />} />
          <Route path="/success" element={<SuccessPage />} />
          <Route path="/order-status/:sessionId" element={<OrderStatusPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
