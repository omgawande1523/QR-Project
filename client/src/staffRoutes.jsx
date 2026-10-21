import { lazy } from 'react';
import { Route, Navigate } from 'react-router';

// Sign-in and staff screens, shared by the website (App.jsx) and the staff app (StaffApp.jsx), so both
// have exactly the same pages and role rules. Every screen is its own chunk.
const LoginPage = lazy(() => import('./features/auth/LoginPage'));
const RegisterPage = lazy(() => import('./features/auth/RegisterPage'));
const ForgotPasswordPage = lazy(() => import('./features/auth/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./features/auth/ResetPasswordPage'));

const OwnerLayout = lazy(() => import('./features/owner/OwnerLayout'));
const DashboardHome = lazy(() => import('./features/owner/DashboardHome'));
const OrdersBoard = lazy(() => import('./features/owner/OrdersBoard'));
const MenuManager = lazy(() => import('./features/owner/MenuManager'));
const TablesPage = lazy(() => import('./features/owner/TablesPage'));
const SettingsPage = lazy(() => import('./features/owner/SettingsPage'));
const StaffPage = lazy(() => import('./features/owner/StaffPage'));
const AnalyticsPage = lazy(() => import('./features/owner/AnalyticsPage'));
const FeedbackPage = lazy(() => import('./features/owner/FeedbackPage'));
const KitchenScreen = lazy(() => import('./features/kitchen/KitchenScreen'));
const RoleGate = lazy(() => import('./features/owner/RoleGate'));

// A function rather than a component: <Routes> needs the <Route> elements themselves.
export function staffRoutes() {
  return (
    <>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      <Route path="/dashboard" element={<OwnerLayout />}>
        <Route index element={<RoleGate area="home"><DashboardHome /></RoleGate>} />
        <Route path="orders" element={<RoleGate area="orders"><OrdersBoard /></RoleGate>} />
        <Route path="menu" element={<RoleGate area="menu"><MenuManager /></RoleGate>} />
        <Route path="tables" element={<RoleGate area="tables"><TablesPage /></RoleGate>} />
        <Route path="analytics" element={<RoleGate area="analytics"><AnalyticsPage /></RoleGate>} />
        <Route path="feedback" element={<RoleGate area="feedback"><FeedbackPage /></RoleGate>} />
        <Route path="staff" element={<RoleGate area="staff"><StaffPage /></RoleGate>} />
        <Route path="settings" element={<RoleGate area="settings"><SettingsPage /></RoleGate>} />
      </Route>
      <Route path="/kitchen" element={<KitchenScreen />} />
      {/* Paths used by the previous version of the app */}
      <Route path="/orders" element={<Navigate to="/dashboard/orders" replace />} />
      <Route path="/profile" element={<Navigate to="/dashboard/settings" replace />} />
    </>
  );
}
