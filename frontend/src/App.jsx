import { Navigate, Route, Routes } from 'react-router-dom';
import AppShell from './components/layout/AppShell.jsx';
import { RequireAuth, RequireRole } from './components/auth/RouteGuards.jsx';
import { homeRouteFor } from './config/navigation.js';
import { useAuth } from './context/AuthContext.jsx';

import LoginPage from './pages/auth/LoginPage.jsx';
import RegisterPage from './pages/auth/RegisterPage.jsx';
import NotFoundPage from './pages/shared/NotFoundPage.jsx';
import NotificationsPage from './pages/shared/NotificationsPage.jsx';
import ProfileSettingsPage from './pages/shared/ProfileSettingsPage.jsx';

import StudentDashboardPage from './pages/student/StudentDashboardPage.jsx';
import StudentProfilePage from './pages/student/StudentProfilePage.jsx';
import StudentSkillsPage from './pages/student/StudentSkillsPage.jsx';
import AvailableDrivesPage from './pages/student/AvailableDrivesPage.jsx';
import EligibilityCheckerPage from './pages/student/EligibilityCheckerPage.jsx';
import MyApplicationsPage from './pages/student/MyApplicationsPage.jsx';
import MyInterviewsPage from './pages/student/MyInterviewsPage.jsx';

import AdminDashboardPage from './pages/admin/AdminDashboardPage.jsx';
import StudentDirectoryPage from './pages/admin/StudentDirectoryPage.jsx';
import StudentDetailPage from './pages/admin/StudentDetailPage.jsx';
import CompanyDirectoryPage from './pages/admin/CompanyDirectoryPage.jsx';
import RecruiterApprovalsPage from './pages/admin/RecruiterApprovalsPage.jsx';
import DriveManagementPage from './pages/admin/DriveManagementPage.jsx';
import ApplicationPipelinePage from './pages/admin/ApplicationPipelinePage.jsx';
import ReportsAnalyticsPage from './pages/admin/ReportsAnalyticsPage.jsx';
import AuditTrailPage from './pages/admin/AuditTrailPage.jsx';

import RecruiterDashboardPage from './pages/recruiter/RecruiterDashboardPage.jsx';
import RecruiterDrivesPage from './pages/recruiter/RecruiterDrivesPage.jsx';
import RecruiterApplicantsPage from './pages/recruiter/RecruiterApplicantsPage.jsx';
import RecruiterInterviewsPage from './pages/recruiter/RecruiterInterviewsPage.jsx';
import RecruiterCompanyPage from './pages/recruiter/RecruiterCompanyPage.jsx';

/**
 * Route table of the application.
 *
 * Every screen is a real page that talks to the `/api/v1/` endpoints - there
 * are no mock screens and no hard coded metrics anywhere in the client.
 */
export default function App() {
  const { role } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      <Route
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route index element={<NavigateToHome />} />

        {/* Student area */}
        <Route
          path="/student"
          element={
            <RequireRole roles={['student']}>
              <StudentDashboardPage />
            </RequireRole>
          }
        />
        <Route
          path="/student/dashboard"
          element={
            <RequireRole roles={['student']}>
              <StudentDashboardPage />
            </RequireRole>
          }
        />
        <Route
          path="/student/profile"
          element={
            <RequireRole roles={['student']}>
              <StudentProfilePage />
            </RequireRole>
          }
        />
        <Route
          path="/student/skills"
          element={
            <RequireRole roles={['student']}>
              <StudentSkillsPage />
            </RequireRole>
          }
        />
        <Route
          path="/student/drives"
          element={
            <RequireRole roles={['student']}>
              <AvailableDrivesPage />
            </RequireRole>
          }
        />
        <Route
          path="/student/eligibility"
          element={
            <RequireRole roles={['student']}>
              <EligibilityCheckerPage />
            </RequireRole>
          }
        />
        <Route
          path="/student/applications"
          element={
            <RequireRole roles={['student']}>
              <MyApplicationsPage />
            </RequireRole>
          }
        />
        <Route
          path="/student/interviews"
          element={
            <RequireRole roles={['student']}>
              <MyInterviewsPage />
            </RequireRole>
          }
        />

        {/* Placement officer area */}
        <Route
          path="/admin/dashboard"
          element={
            <RequireRole roles={['admin']}>
              <AdminDashboardPage />
            </RequireRole>
          }
        />
        <Route
          path="/admin/students"
          element={
            <RequireRole roles={['admin']}>
              <StudentDirectoryPage />
            </RequireRole>
          }
        />
        <Route
          path="/admin/students/:id"
          element={
            <RequireRole roles={['admin']}>
              <StudentDetailPage />
            </RequireRole>
          }
        />
        <Route
          path="/admin/companies"
          element={
            <RequireRole roles={['admin']}>
              <CompanyDirectoryPage />
            </RequireRole>
          }
        />
        <Route
          path="/admin/recruiters"
          element={
            <RequireRole roles={['admin']}>
              <RecruiterApprovalsPage />
            </RequireRole>
          }
        />
        <Route
          path="/admin/drives"
          element={
            <RequireRole roles={['admin']}>
              <DriveManagementPage />
            </RequireRole>
          }
        />
        <Route
          path="/admin/applications"
          element={
            <RequireRole roles={['admin']}>
              <ApplicationPipelinePage />
            </RequireRole>
          }
        />
        <Route
          path="/admin/reports"
          element={
            <RequireRole roles={['admin']}>
              <ReportsAnalyticsPage />
            </RequireRole>
          }
        />
        <Route
          path="/admin/audit-logs"
          element={
            <RequireRole roles={['admin']}>
              <AuditTrailPage />
            </RequireRole>
          }
        />

        {/* Recruiter area */}
        <Route
          path="/recruiter/dashboard"
          element={
            <RequireRole roles={['recruiter']}>
              <RecruiterDashboardPage />
            </RequireRole>
          }
        />
        <Route
          path="/recruiter/drives"
          element={
            <RequireRole roles={['recruiter']}>
              <RecruiterDrivesPage />
            </RequireRole>
          }
        />
        <Route
          path="/recruiter/applications"
          element={
            <RequireRole roles={['recruiter']}>
              <RecruiterApplicantsPage />
            </RequireRole>
          }
        />
        <Route
          path="/recruiter/interviews"
          element={
            <RequireRole roles={['recruiter']}>
              <RecruiterInterviewsPage />
            </RequireRole>
          }
        />
        <Route
          path="/recruiter/company"
          element={
            <RequireRole roles={['recruiter']}>
              <RecruiterCompanyPage />
            </RequireRole>
          }
        />

        {/* Shared */}
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/profile" element={<ProfileSettingsPage />} />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

/** Sends an authenticated user to the landing page of their role. */
function NavigateToHome() {
  const { role } = useAuth();
  return <Navigate to={homeRouteFor(role)} replace />;
}
