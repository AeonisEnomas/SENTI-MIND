import { useState, Suspense } from "react";
import PageLoader from "../components/PageLoader";
import { Outlet, NavLink, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import SentiBotFAB from "../components/SentiBotFAB";
import WarmupBanner from "../components/WarmupBanner";
import { useServerWarmup } from "../hooks/useServerWarmup";
import { useDoubleEscape, quickExit } from "../hooks/useQuickHide";

const QUICK_EXIT_HINT = "Leave this site immediately. Shortcut: press Esc twice.";

const QuickExitIcon = () => (
  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" x2="21" y1="14" y2="3"/>
  </svg>
);

const NAV_LINKS = [
  {
    to: ".",
    label: "Journal",
    end: true,
    icon: (
      <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
        <path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>
      </svg>
    ),
  },
  {
    to: "heatmap",
    label: "Mood",
    icon: (
      <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
        <rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/>
        <path d="M8 14h.01"/><path d="M12 14h.01"/><path d="M16 14h.01"/><path d="M8 18h.01"/><path d="M12 18h.01"/><path d="M16 18h.01"/>
      </svg>
    ),
  },
  {
    to: "history",
    label: "History",
    icon: (
      <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
      </svg>
    ),
  },
  {
    to: "screener",
    label: "Screener",
    icon: (
      <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
      </svg>
    ),
  },
  {
    to: "wellness",
    label: "Wellness",
    icon: (
      <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
        <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
      </svg>
    ),
  },
  {
    to: "gratitude",
    label: "Gratitude",
    icon: (
      <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
        <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
      </svg>
    ),
  },
  {
    to: "chat",
    label: "AI Chat",
    icon: (
      <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
        <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>
      </svg>
    ),
  },
];

// Bottom tab bar shows only first 5 links. Gratitude goes into sidebar overflow.
const BOTTOM_TABS = NAV_LINKS.slice(0, 5);

export default function DashboardLayout() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { isCold, isWarm, elapsedSeconds } = useServerWarmup();

  // Emergency quick exit: deliberate double-Escape. Escape presses consumed by
  // dialogs (which call preventDefault) are ignored.
  useDoubleEscape(quickExit);

  // Close sidebar when navigating
  const location = useLocation();
  const [lastPath, setLastPath] = useState(location.pathname);
  if (lastPath !== location.pathname) {
    setLastPath(location.pathname);
    setSidebarOpen(false);
  }

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <div 
      className="flex h-screen bg-sage-50 overflow-hidden"
      style={{ backgroundImage: "url('/dashboard-texture.png')", backgroundRepeat: "repeat", backgroundSize: "auto" }}
    >

      {/* =====================================================================
          DESKTOP SIDEBAR (hidden on mobile)
      ===================================================================== */}
      <aside className="hidden md:flex w-64 bg-white/70 backdrop-blur-2xl border-r border-sage-200/60 shadow-lg flex-col z-20 flex-shrink-0">
        {/* Logo */}
        <div className="p-5 border-b border-sage-100/60">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center shadow-sm border border-sage-100 overflow-hidden">
              <img src="/logo.png" alt="SentiMind Logo" className="w-full h-full object-cover p-1" />
            </div>
            <span className="font-bold text-lg text-warm-800 tracking-tight">
              Senti<span className="text-sage-600">Mind</span>
            </span>
          </div>
          <p className="text-[10px] font-semibold text-sage-600 bg-sage-100/60 px-3 py-1 rounded-full truncate border border-sage-200/50" title={user?.email}>
            {user?.email}
          </p>
        </div>

        {/* Nav Links */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
          {NAV_LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? "bg-sage-100 text-sage-800 shadow-sm"
                    : "text-warm-600 hover:bg-sage-50 hover:text-sage-700"
                }`
              }
            >
              <span>{link.icon}</span>
              {link.label}
            </NavLink>
          ))}
        </nav>

        {/* Footer buttons */}
        <div className="p-3 border-t border-sage-100/60 space-y-1.5">
          <button
            type="button"
            onClick={quickExit}
            title={QUICK_EXIT_HINT}
            aria-label="Quick exit: leave this site now (shortcut: press Escape twice)"
            className="flex items-center justify-center gap-2 w-full px-3 py-2.5 text-sm font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-xl transition-all border border-rose-200/60"
          >
            <QuickExitIcon />
            Quick exit
            <kbd className="ml-1 text-[10px] font-medium text-rose-500 bg-white/70 border border-rose-200 rounded px-1">Esc ×2</kbd>
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center justify-center gap-2 w-full px-3 py-2.5 text-sm font-medium text-warm-600 hover:bg-warm-100 rounded-xl transition-all"
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/>
            </svg>
            Sign Out
          </button>
        </div>
      </aside>

      {/* =====================================================================
          MOBILE SLIDE-OVER DRAWER (visible when sidebarOpen)
      ===================================================================== */}
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          {/* Drawer panel */}
          <aside className="relative w-72 max-w-[85vw] bg-white flex flex-col shadow-2xl z-10 animate-medical-slide-up">
            <div className="p-5 border-b border-sage-100">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center shadow-sm border border-sage-100 overflow-hidden">
                    <img src="/logo.png" alt="SentiMind" className="w-full h-full object-cover p-1" />
                  </div>
                  <span className="font-bold text-lg text-warm-800 tracking-tight">
                    Senti<span className="text-sage-600">Mind</span>
                  </span>
                </div>
                <button onClick={() => setSidebarOpen(false)} aria-label="Close menu" className="p-2 rounded-lg text-warm-500 hover:bg-sage-50">
                  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
              <p className="text-[10px] font-semibold text-sage-600 bg-sage-100 px-3 py-1 rounded-full truncate border border-sage-200/50">
                {user?.email}
              </p>
            </div>

            <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
              {NAV_LINKS.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  end={link.end}
                  className={({ isActive }) =>
                    `flex items-center gap-4 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                      isActive
                        ? "bg-sage-100 text-sage-800"
                        : "text-warm-600 hover:bg-sage-50 hover:text-sage-700"
                    }`
                  }
                >
                  <span>{link.icon}</span>
                  {link.label}
                </NavLink>
              ))}
            </nav>

            <div className="p-4 border-t border-sage-100 space-y-2">
              <button
                type="button"
                onClick={quickExit}
                title={QUICK_EXIT_HINT}
                className="flex items-center justify-center gap-2 w-full px-3 py-3 text-sm font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-xl border border-rose-200"
              >
                <QuickExitIcon />
                Quick exit
              </button>
              <button
                onClick={handleLogout}
                className="flex items-center justify-center gap-2 w-full px-3 py-3 text-sm font-medium text-warm-600 hover:bg-warm-100 rounded-xl"
              >
                Sign Out
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* =====================================================================
          MAIN CONTENT AREA
      ===================================================================== */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Mobile Top Bar */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 bg-white/80 backdrop-blur-md border-b border-sage-200/60 z-10 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white border border-sage-100 overflow-hidden shadow-sm">
              <img src="/logo.png" alt="SentiMind" className="w-full h-full object-cover p-0.5" />
            </div>
            <span className="font-bold text-base text-warm-800 tracking-tight">
              Senti<span className="text-sage-600">Mind</span>
            </span>
          </div>
          <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={quickExit}
            title={QUICK_EXIT_HINT}
            aria-label="Quick exit: leave this site now"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg border border-rose-200/60"
          >
            <QuickExitIcon />
            Exit
          </button>
          <button
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
            className="p-2 rounded-xl text-warm-600 hover:bg-sage-100 transition-colors"
          >
            <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
              <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>
          </div>
        </header>

        {/* Cold-start warm-up banner */}
        <WarmupBanner isCold={isCold} isWarm={isWarm} elapsedSeconds={elapsedSeconds} />

        {/* Page content */}
        <main className="flex-1 overflow-y-auto scroll-smooth">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 pb-28 md:pb-8 md:py-8">
            <Suspense fallback={<PageLoader />}>
              <Outlet />
            </Suspense>
          </div>
        </main>

        {/* =====================================================================
            MOBILE BOTTOM TAB BAR (hidden on md+)
        ===================================================================== */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/90 backdrop-blur-xl border-t border-sage-200/70 flex items-stretch safe-bottom">
          {BOTTOM_TABS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center justify-center gap-1 py-2.5 px-1 text-[10px] font-semibold tracking-wide transition-all duration-150 ${
                  isActive
                    ? "text-sage-700"
                    : "text-warm-400 hover:text-sage-600"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span className={`transition-transform duration-150 ${isActive ? "scale-110" : ""}`}>
                    {link.icon}
                  </span>
                  <span>{link.label}</span>
                  {isActive && (
                    <span className="absolute -top-px left-1/2 -translate-x-1/2 w-8 h-0.5 bg-sage-500 rounded-full" />
                  )}
                </>
              )}
            </NavLink>
          ))}
          {/* More button triggers drawer */}
          <button
            onClick={() => setSidebarOpen(true)}
            aria-label="More navigation options"
            className="flex-1 flex flex-col items-center justify-center gap-1 py-2.5 px-1 text-[10px] font-semibold tracking-wide text-warm-400 hover:text-sage-600 transition-colors"
          >
            <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>
            </svg>
            <span>More</span>
          </button>
        </nav>

        {/* SentiBot floating action button — navigates to AI Chat */}
        <SentiBotFAB />
      </div>
    </div>
  );
}
