import { lazy, Suspense, type ComponentType } from "react";
import { Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";

const DashboardPage = lazy(() => import("./pages/DashboardPage").then((module) => ({ default: module.DashboardPage })));
const NewStudyPage = lazy(() => import("./pages/NewStudyPage").then((module) => ({ default: module.NewStudyPage })));
const RecallPage = lazy(() => import("./pages/RecallPage").then((module) => ({ default: module.RecallPage })));
const RecallResultPage = lazy(() => import("./pages/RecallResultPage").then((module) => ({ default: module.RecallResultPage })));
const StudySessionPage = lazy(() => import("./pages/StudySessionPage").then((module) => ({ default: module.StudySessionPage })));
const LoginPage = lazy(() => import("./pages/LoginPage").then((module) => ({ default: module.LoginPage })));
const RegisterPage = lazy(() => import("./pages/RegisterPage").then((module) => ({ default: module.RegisterPage })));
const GoalsPage = lazy(() => import("./pages/GoalsPage").then((module) => ({ default: module.GoalsPage })));
const PlanPage = lazy(() => import("./pages/PlanPage").then((module) => ({ default: module.PlanPage })));
const LearnerPage = lazy(() => import("./pages/LearnerPage").then((module) => ({ default: module.LearnerPage })));
const NewGoalPage = lazy(() => import("./pages/NewGoalPage").then((module) => ({ default: module.NewGoalPage })));
const GoalDetailPage = lazy(() => import("./pages/GoalDetailPage").then((module) => ({ default: module.GoalDetailPage })));
const KnowledgePage = lazy(() => import("./pages/KnowledgePage").then((module) => ({ default: module.KnowledgePage })));
const KnowledgeRolePage = lazy(() => import("./pages/KnowledgeRolePage").then((module) => ({ default: module.KnowledgeRolePage })));
const BaselinePage = lazy(() => import("./pages/BaselinePage").then((module) => ({ default: module.BaselinePage })));
const BaselineResultPage = lazy(() => import("./pages/BaselineResultPage").then((module) => ({ default: module.BaselineResultPage })));
const AssessmentPage = lazy(() => import("./pages/AssessmentPage").then((module) => ({ default: module.AssessmentPage })));
const SettingsPage = lazy(() => import("./pages/SettingsPage").then((module) => ({ default: module.SettingsPage })));
const ResourcesPage = lazy(() => import("./pages/ResourcesPage").then((module) => ({ default: module.ResourcesPage })));
const GroundedRemediationPage = lazy(() => import("./pages/GroundedRemediationPage").then((module) => ({ default: module.GroundedRemediationPage })));
const LandingPage = lazy(() => import("./pages/LandingPage").then((module) => ({ default: module.LandingPage })));
const OnboardingPage = lazy(() => import("./pages/OnboardingPage").then((module) => ({ default: module.OnboardingPage })));
const ReadinessPage = lazy(() => import("./pages/ReadinessPage").then((module) => ({ default: module.ReadinessPage })));
const KnowledgeCheckPage = lazy(() => import("./pages/KnowledgeCheckPage").then((module) => ({ default: module.KnowledgeCheckPage })));
const ReviewImprovePage = lazy(() => import("./pages/ReviewImprovePage").then((module) => ({ default: module.ReviewImprovePage })));

function PageView({ page: Page }: { page: ComponentType }) {
  return <Suspense fallback={<div role="status" aria-live="polite" style={{ minHeight: "100vh", display: "grid", placeItems: "center", color: "var(--muted)", background: "var(--canvas)" }}>Loading page…</div>}><Page /></Suspense>;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<PageView page={LoginPage} />} />
      <Route path="/register" element={<PageView page={RegisterPage} />} />
      <Route path="/" element={<PageView page={LandingPage} />} />
      <Route element={<Layout />}>
        <Route path="/dashboard" element={<PageView page={DashboardPage} />} />
        <Route path="/knowledge-check" element={<PageView page={KnowledgeCheckPage} />} />
        <Route path="/review" element={<PageView page={ReviewImprovePage} />} />
        <Route path="/readiness" element={<PageView page={ReadinessPage} />} />
        <Route path="/onboarding" element={<PageView page={OnboardingPage} />} />
        <Route path="/study/new" element={<PageView page={NewStudyPage} />} />
        <Route path="/study/:id" element={<PageView page={StudySessionPage} />} />
        <Route path="/recall/:attemptId" element={<PageView page={RecallPage} />} />
        <Route path="/assessments/:id" element={<PageView page={AssessmentPage} />} />
        <Route
          path="/recall/:attemptId/result"
          element={<PageView page={RecallResultPage} />}
        />
        <Route path="/goals" element={<PageView page={GoalsPage} />} />
        <Route path="/goals/new" element={<PageView page={NewGoalPage} />} />
        <Route path="/goals/:id" element={<PageView page={GoalDetailPage} />} />
        <Route path="/goals/:id/readiness" element={<PageView page={ReadinessPage} />} />
        <Route path="/plan" element={<PageView page={PlanPage} />} />
        <Route path="/plan/today" element={<PageView page={PlanPage} />} />
        <Route path="/learner" element={<PageView page={LearnerPage} />} />
        <Route path="/settings" element={<PageView page={SettingsPage} />} />
        <Route path="/resources" element={<PageView page={ResourcesPage} />} />
        <Route path="/remediations/:id" element={<PageView page={GroundedRemediationPage} />} />
        <Route path="/knowledge" element={<PageView page={KnowledgePage} />} />
        <Route path="/knowledge/roles/:id" element={<PageView page={KnowledgeRolePage} />} />
        <Route path="/baseline/:id" element={<PageView page={BaselinePage} />} />
        <Route path="/baseline/:id/result" element={<PageView page={BaselineResultPage} />} />
      </Route>
    </Routes>
  );
}
