import { lazy, Suspense } from "react";
import Feed from "./pages/Feed";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { LanguageProvider } from "@/i18n/LanguageContext";
import { LawOfLightGuard } from "@/components/auth/LawOfLightGuard";

// Lazy load pages for code splitting
const Auth = lazy(() => import("./pages/Auth"));
const Friends = lazy(() => import("./pages/Friends"));
const Profile = lazy(() => import("./pages/Profile"));
const Wallet = lazy(() => import("./pages/Wallet"));
const Post = lazy(() => import("./pages/Post"));
const About = lazy(() => import("./pages/About"));
const Leaderboard = lazy(() => import("./pages/Leaderboard"));
const AdminMigration = lazy(() => import("./pages/AdminMigration"));
const Admin = lazy(() => import("./pages/Admin"));
const NotFound = lazy(() => import("./pages/NotFound"));
const LawOfLight = lazy(() => import("./pages/LawOfLight"));
const Notifications = lazy(() => import("./pages/Notifications"));
const DocsRouter = lazy(() => import("./pages/DocsRouter"));
const ConnectedApps = lazy(() => import("./pages/ConnectedApps"));
const SetPassword = lazy(() => import("./pages/SetPassword"));
const Chat = lazy(() => import("./pages/Chat"));
const Install = lazy(() => import("./pages/Install"));

// Optimized QueryClient with caching
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes (was cacheTime)
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

// Loading fallback component with smooth animation
const PageLoader = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <div className="flex flex-col items-center gap-4 animate-fade-in">
      <div className="w-10 h-10 md:w-12 md:h-12 border-3 md:border-4 border-primary border-t-transparent rounded-full animate-spin" />
      <p className="text-sm text-muted-foreground">Loading...</p>
    </div>
  </div>
);

function App() {
  return (
    <LanguageProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Suspense fallback={<PageLoader />}>
              <LawOfLightGuard>
                <Routes>
                  <Route path="/begin" element={<Navigate to="/law-of-light" replace />} />
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/set-password" element={<SetPassword />} />
                  <Route path="/law-of-light" element={<LawOfLight />} />
                  <Route path="/" element={<Feed />} />
                  <Route path="/friends" element={<Friends />} />
                  <Route path="/profile" element={<Profile />} />
                  <Route path="/profile/:userId" element={<Profile />} />
                  <Route path="/profile/connected-apps" element={<ConnectedApps />} />
                  <Route path="/@:username" element={<Profile />} />
                  <Route path="/wallet" element={<Wallet />} />
                  <Route path="/post/:postId" element={<Post />} />
                  <Route path="/about" element={<About />} />
                  <Route path="/leaderboard" element={<Leaderboard />} />
                  <Route path="/admin/migration" element={<AdminMigration />} />
                  <Route path="/admin" element={<Admin />} />
                  <Route path="/notifications" element={<Notifications />} />
                  <Route path="/chat" element={<Chat />} />
                  <Route path="/chat/:conversationId" element={<Chat />} />
                  <Route path="/docs/*" element={<DocsRouter />} />
                  <Route path="/install" element={<Install />} />
                  {/* Dynamic username route - must be AFTER static routes */}
                  <Route path="/:username" element={<Profile />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </LawOfLightGuard>
            </Suspense>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </LanguageProvider>
  );
}

export default App;
