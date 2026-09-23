import { Navigate, Route, Routes } from "react-router-dom";
import { AdminLayout, DashboardLayout, ToolLayout } from "./components/Layout";
import RequireAdmin from "./components/RequireAdmin";
import RequireAuth from "./components/RequireAuth";
import { AuthProvider } from "./context/AuthContext";
import AdminPage from "./pages/Admin";
import Home from "./pages/Home";
import ImagesPage from "./pages/Images";
import LoginPage from "./pages/Login";
import PresentationPage from "./pages/Presentation";
import ProfilePage from "./pages/Profile";
import ProjectsPage from "./pages/Projects";
import QmzhPage from "./pages/Qmzh";
import TakeTestPage from "./pages/TakeTest";
import TestsPage from "./pages/Tests";

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="login" element={<LoginPage />} />
        {/* Оқушы беті: жүйеге кірусіз, мұғалім жіберген сілтеме арқылы. */}
        <Route path="t/:code" element={<TakeTestPage />} />
        <Route element={<RequireAuth />}>
          <Route element={<DashboardLayout />}>
            <Route index element={<Home />} />
          </Route>
          <Route element={<ToolLayout />}>
            <Route path="qmzh" element={<QmzhPage />} />
            <Route path="presentation" element={<PresentationPage />} />
            <Route path="images" element={<ImagesPage />} />
            <Route path="tests" element={<TestsPage />} />
            <Route path="projects" element={<ProjectsPage />} />
            <Route path="profile" element={<ProfilePage />} />
          </Route>
          <Route element={<RequireAdmin />}>
            <Route element={<AdminLayout />}>
              <Route path="admin" element={<AdminPage />} />
            </Route>
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
