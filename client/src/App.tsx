import { Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { DashboardPage } from "./pages/DashboardPage";
import { NewStudyPage } from "./pages/NewStudyPage";
import { RecallPage } from "./pages/RecallPage";
import { RecallResultPage } from "./pages/RecallResultPage";
import { StudySessionPage } from "./pages/StudySessionPage";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { GoalsPage } from "./pages/GoalsPage";
import { PlanPage } from "./pages/PlanPage";
import { LearnerPage } from "./pages/LearnerPage";
import { NewGoalPage } from "./pages/NewGoalPage";
import { GoalDetailPage } from "./pages/GoalDetailPage";
import { KnowledgePage } from "./pages/KnowledgePage";
import { KnowledgeRolePage } from "./pages/KnowledgeRolePage";
import { BaselinePage } from "./pages/BaselinePage";
import { BaselineResultPage } from "./pages/BaselineResultPage";
import { AssessmentPage } from "./pages/AssessmentPage";
import { SettingsPage } from "./pages/SettingsPage";
import { ResourcesPage } from "./pages/ResourcesPage";

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route element={<Layout />}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/study/new" element={<NewStudyPage />} />
        <Route path="/study/:id" element={<StudySessionPage />} />
        <Route path="/recall/:attemptId" element={<RecallPage />} />
        <Route path="/assessments/:id" element={<AssessmentPage />} />
        <Route
          path="/recall/:attemptId/result"
          element={<RecallResultPage />}
        />
        <Route path="/goals" element={<GoalsPage />} />
        <Route path="/goals/new" element={<NewGoalPage />} />
        <Route path="/goals/:id" element={<GoalDetailPage />} />
        <Route path="/plan" element={<PlanPage />} />
        <Route path="/plan/today" element={<PlanPage />} />
        <Route path="/learner" element={<LearnerPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/resources" element={<ResourcesPage />} />
        <Route path="/knowledge" element={<KnowledgePage />} />
        <Route path="/knowledge/roles/:id" element={<KnowledgeRolePage />} />
        <Route path="/baseline/:id" element={<BaselinePage />} />
        <Route path="/baseline/:id/result" element={<BaselineResultPage />} />
      </Route>
    </Routes>
  );
}
