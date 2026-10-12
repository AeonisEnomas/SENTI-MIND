import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import PageLoader from "./components/PageLoader";

// Route-level code splitting: each page is its own chunk.
const LoginPage = lazy(() => import("./pages/LoginPage"));
const RegisterPage = lazy(() => import("./pages/RegisterPage"));
const DashboardLayout = lazy(() => import("./pages/DashboardLayout"));
const JournalPage = lazy(() => import("./pages/JournalPage"));
const MoodHeatmapPage = lazy(() => import("./pages/MoodHeatmapPage"));
const HistoryPage = lazy(() => import("./pages/HistoryPage"));
const GratitudeJarPage = lazy(() => import("./pages/GratitudeJarPage"));
const ScreenerPage = lazy(() => import("./pages/ScreenerPage"));
const WellnessToolsPage = lazy(() => import("./pages/WellnessToolsPage"));
const ChatPage = lazy(() => import("./pages/ChatPage"));

export default function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<JournalPage />} />
          <Route path="heatmap" element={<MoodHeatmapPage />} />
          <Route path="history" element={<HistoryPage />} />
          <Route path="gratitude" element={<GratitudeJarPage />} />
          <Route path="screener" element={<ScreenerPage />} />
          <Route path="wellness" element={<WellnessToolsPage />} />
          <Route path="chat" element={<ChatPage />} />
        </Route>

        {/* Default redirect */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Suspense>
  );
}
