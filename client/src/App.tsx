import { Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { DashboardPage } from "./pages/DashboardPage";
import { NewStudyPage } from "./pages/NewStudyPage";
import { RecallPage } from "./pages/RecallPage";
import { RecallResultPage } from "./pages/RecallResultPage";
import { StudySessionPage } from "./pages/StudySessionPage";

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/study/new" element={<NewStudyPage />} />
        <Route path="/study/:id" element={<StudySessionPage />} />
        <Route path="/recall/:attemptId" element={<RecallPage />} />
        <Route path="/recall/:attemptId/result" element={<RecallResultPage />} />
      </Route>
    </Routes>
  );
}
