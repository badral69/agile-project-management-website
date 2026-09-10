import { lazy, Suspense } from "react";
import type { ReactElement } from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { ProtectedRoute } from "../components/ProtectedRoute";
import { RoleGuard } from "../components/RoleGuard";
import { HexSpinner } from "../components/ui/HexSpinner";
import { AppLayout } from "../layouts/AppLayout";

const DashboardPage = lazy(() => import("../pages/DashboardPage"));
const ProjectsPage = lazy(() => import("../pages/ProjectsPage"));
const ProjectDetailPage = lazy(() => import("../pages/ProjectDetailPage"));
const TasksPage = lazy(() => import("../pages/TasksPage"));
const TeamPage = lazy(() => import("../pages/TeamPage"));
const AdminUsersPage = lazy(() => import("../pages/AdminUsersPage"));
const AdminCompaniesPage = lazy(() => import("../pages/AdminCompaniesPage"));
const CompanyWorkspacePage = lazy(() => import("../pages/CompanyWorkspacePage"));
const PerformancePage = lazy(() => import("../pages/PerformancePage"));
const HomePage = lazy(() => import("../pages/HomePage"));
const LoginPage = lazy(() => import("../pages/LoginPage"));
const ForgotPasswordPage = lazy(() => import("../pages/ForgotPasswordPage"));
const RegisterPage = lazy(() => import("../pages/RegisterPage"));
const CheckoutPage = lazy(() => import("../pages/CheckoutPage"));
const CheckoutSuccessPage = lazy(() => import("../pages/CheckoutSuccessPage"));
const SettingsPage = lazy(() => import("../pages/SettingsPage"));
const InboxPage = lazy(() => import("../pages/InboxPage"));
const VerifyEmailPage = lazy(() => import("../pages/VerifyEmailPage"));
const NotFoundPage = lazy(() => import("../pages/NotFoundPage"));

const withSuspense = (element: ReactElement) => (
  <ErrorBoundary>
    <Suspense
      fallback={
        <div className="page-loader page-loader-spinner">
          <HexSpinner size={58} label="Loading module..." />
        </div>
      }
    >
      {element}
    </Suspense>
  </ErrorBoundary>
);

export const router = createBrowserRouter([
  {
    path: "/",
    element: withSuspense(<HomePage />),
  },
  {
    path: "/login",
    element: withSuspense(<LoginPage />),
  },
  {
    path: "/forgot-password",
    element: withSuspense(<ForgotPasswordPage />),
  },
  {
    path: "/register",
    element: withSuspense(<RegisterPage />),
  },
  {
    path: "/checkout",
    element: withSuspense(<CheckoutPage />),
  },
  {
    path: "/checkout/success",
    element: withSuspense(<CheckoutSuccessPage />),
  },
  {
    path: "/verify-email",
    element: withSuspense(<VerifyEmailPage />),
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        path: "/workspace",
        element: <AppLayout />,
        children: [
          { index: true, element: <Navigate to="/workspace/dashboard" replace /> },
          { path: "/workspace/dashboard", element: withSuspense(<DashboardPage />) },
          { path: "/workspace/projects", element: withSuspense(<ProjectsPage />) },
          { path: "/workspace/projects/:id", element: withSuspense(<ProjectDetailPage />) },
          { path: "/workspace/tasks", element: withSuspense(<TasksPage />) },
          {
            path: "/workspace/team",
            element: withSuspense(
              <RoleGuard roles={["ADMIN"]}>
                <TeamPage />
              </RoleGuard>,
            ),
          },
          { path: "/workspace/inbox", element: withSuspense(<InboxPage />) },
          {
            path: "/workspace/performance",
            element: withSuspense(
              <RoleGuard roles={["ADMIN"]}>
                <PerformancePage />
              </RoleGuard>,
            ),
          },
          { path: "/workspace/companies/:id", element: withSuspense(<CompanyWorkspacePage />) },
          { path: "/workspace/settings", element: withSuspense(<SettingsPage />) },
          {
            path: "/workspace/admin/companies",
            element: withSuspense(
              <RoleGuard roles={["ADMIN"]}>
                <AdminCompaniesPage />
              </RoleGuard>,
            ),
          },
          {
            path: "/workspace/admin/users",
            element: withSuspense(
              <RoleGuard roles={["ADMIN"]}>
                <AdminUsersPage />
              </RoleGuard>,
            ),
          },
        ],
      },
    ],
  },
  {
    path: "*",
    element: withSuspense(<NotFoundPage />),
  },
]);
