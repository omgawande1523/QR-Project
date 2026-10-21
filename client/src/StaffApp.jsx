import { Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router';
import { ToastProvider } from './components/ui';
import { PageLoader } from './components/PageLoader';
import { AppShell } from './app/AppShell';
import { staffRoutes } from './staffRoutes';
import { getRole, isLoggedIn } from './lib/session';
import { homeFor } from './lib/roles';

// Any other address: the signed-in person's start screen (kitchen display or dashboard), or Login.
function Start() {
  return <Navigate to={isLoggedIn() ? homeFor(getRole()) : '/login'} replace />;
}

// The staff app (QR Menu Staff): the sign-in and staff screens of the website, nothing a guest uses.
// Built by `vite build --mode app` from main.app.jsx, which never imports App.jsx.
export default function StaffApp() {
  return (
    <ToastProvider>
      <Router>
        <AppShell>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              {staffRoutes()}
              <Route path="*" element={<Start />} />
            </Routes>
          </Suspense>
        </AppShell>
      </Router>
    </ToastProvider>
  );
}
