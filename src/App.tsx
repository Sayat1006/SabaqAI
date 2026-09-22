import { Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import RequireAdmin from "./components/RequireAdmin";
import RequireAuth from "./components/RequireAuth";
import { AuthProvider } from "./context/AuthContext";
import AdminPage from "./pages/Admin";
import AssistantPage from "./pages/Assistant";
import ClassesPage from "./pages/Classes";
import CompilerPage from "./pages/Compiler";
import DictationPage from "./pages/Dictation";
import DodaPage from "./pages/Doda";
import EncyclopediaPage from "./pages/Encyclopedia";
import Home from "./pages/Home";
import ImagesPage from "./pages/Images";
import KtjPage from "./pages/Ktj";
import LabPage from "./pages/Lab";
import LibraryPage from "./pages/Library";
import LoginPage from "./pages/Login";
import MaterialQuestionsPage from "./pages/MaterialQuestions";
import PresentationPage from "./pages/Presentation";
import QmzhPage from "./pages/Qmzh";
import SchedulePage from "./pages/Schedule";

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="login" element={<LoginPage />} />
        <Route element={<RequireAuth />}>
          <Route element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="schedule" element={<SchedulePage />} />
            <Route path="ktj" element={<KtjPage />} />
            <Route path="qmzh" element={<QmzhPage />} />
            <Route path="presentation" element={<PresentationPage />} />
            <Route path="images" element={<ImagesPage />} />
            <Route path="doda" element={<DodaPage />} />
            <Route path="lab" element={<LabPage />} />
            <Route path="compiler" element={<CompilerPage />} />
            <Route path="assistant" element={<AssistantPage />} />
            <Route path="material-questions" element={<MaterialQuestionsPage />} />
            <Route path="dictation" element={<DictationPage />} />
            <Route path="encyclopedia" element={<EncyclopediaPage />} />
            <Route path="library" element={<LibraryPage />} />
            <Route path="classes" element={<ClassesPage />} />
            <Route element={<RequireAdmin />}>
              <Route path="admin" element={<AdminPage />} />
            </Route>
          </Route>
        </Route>
      </Routes>
    </AuthProvider>
  );
}
