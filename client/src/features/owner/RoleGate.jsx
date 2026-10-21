import { Navigate } from 'react-router';
import { useOwner } from './OwnerContext';
import { Spinner } from '../../components/ui';
import { can, homeFor } from '../../lib/roles';

// Shows a dashboard page only to roles allowed to use it; others go to their own start page.
// Until /api/users/me answers, the role stored at login decides (the server enforces access anyway).
export default function RoleGate({ area, children }) {
  const { role, me } = useOwner();
  if (!me.userId && !can(role, area)) {
    return <div style={{ minHeight: '40vh', display: 'grid', placeItems: 'center', color: 'var(--olive-700)' }}><Spinner /></div>;
  }
  return can(role, area) ? children : <Navigate to={homeFor(role)} replace />;
}
