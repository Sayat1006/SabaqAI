import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AdminLayout, DashboardLayout, ToolLayout } from "./components/Layout";
import RequireAdmin from "./components/RequireAdmin";
import RequireAuth from "./components/RequireAuth";
import { AuthProvider } from "./context/AuthContext";
import { PageLoader } from "./components/PageLoader";

// Әр бет өз файлымен, ашылғанда ғана жүктеледі — алғашқы ашылу жылдамырақ.
const AdminPage = lazy(() => import("./pages/Admin"));
const Home = lazy(() => import("./pages/Home"));
const ImagesPage = lazy(() => import("./pages/Images"));
const LoginPage = lazy(() => import("./pages/Login"));
const PresentationPage = lazy(() => import("./pages/Presentation"));
const ProfilePage = lazy(() => import("./pages/Profile"));
const ProjectsPage = lazy(() => import("./pages/Projects"));
const QmzhPage = lazy(() => import("./pages/Qmzh"));
const TakeTestPage = lazy(() => import("./pages/TakeTest"));
const ClassToolsPage = lazy(() => import("./pages/ClassTools"));
const TestsPage = lazy(() => import("./pages/Tests"));
const DocsPage = lazy(() => import("./pages/Docs"));
const KtzhPage = lazy(() => import("./pages/Ktzh"));
const ProgressPage = lazy(() => import("./pages/Progress"));
const LiveHostPage = lazy(() => import("./pages/LiveHost"));
const LivePlayPage = lazy(() => import("./pages/LivePlay"));
const SchedulePage = lazy(() => import("./pages/Schedule"));
const AdminNewsPage = lazy(() => import("./pages/AdminNews"));
const AdminUsagePage = lazy(() => import("./pages/AdminUsage"));

export default function App() {
  return (
    <AuthProvider>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="login" element={<LoginPage />} />
          {/* Оқушы беті: жүйеге кірусіз, мұғалім жіберген сілтеме арқылы. */}
          <Route path="t/:code" element={<TakeTestPage />} />
          <Route path="l" element={<LivePlayPage />} />
          <Route path="l/:code" element={<LivePlayPage />} />
          <Route element={<RequireAuth />}>
            {/* Тірі викторина: тақтаға толық бетпен шығады (мәзірсіз). */}
            <Route path="live/:id" element={<LiveHostPage />} />
            <Route element={<DashboardLayout />}>
              <Route index element={<Home />} />
            </Route>
            <Route element={<ToolLayout />}>
              <Route path="schedule" element={<SchedulePage />} />
              <Route path="qmzh" element={<QmzhPage />} />
              <Route path="presentation" element={<PresentationPage />} />
              <Route path="images" element={<ImagesPage />} />
              <Route path="tests" element={<TestsPage />} />
              <Route path="tools" element={<ClassToolsPage />} />
              <Route path="docs" element={<DocsPage />} />
              <Route path="ktzh" element={<KtzhPage />} />
              <Route path="progress" element={<ProgressPage />} />
              <Route path="projects" element={<ProjectsPage />} />
              <Route path="profile" element={<ProfilePage />} />
            </Route>
            <Route element={<RequireAdmin />}>
              <Route element={<AdminLayout />}>
                <Route path="admin" element={<AdminPage />} />
                <Route path="admin/news" element={<AdminNewsPage />} />
                <Route path="admin/usage" element={<AdminUsagePage />} />
              </Route>
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </AuthProvider>
  );
}
