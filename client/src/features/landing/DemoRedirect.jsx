import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Store } from 'lucide-react';
import { Button, EmptyState, Spinner } from '../../components/ui';
import { api } from '../../lib/api';

// "Try live demo": opens the seeded demo restaurant's menu at its first table.
export default function DemoRedirect() {
  const navigate = useNavigate();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    api.get('/api/public/demo')
      .then((res) => navigate(`/menu/${res.data.restaurantId}?table=${res.data.table}`, { replace: true }))
      .catch(() => setFailed(true));
  }, [navigate]);

  if (failed) {
    return (
      <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
        <EmptyState icon={<Store size={28} />} title="The demo is not available right now" action={<Button to="/">Back to home</Button>}>
          Please try again in a moment.
        </EmptyState>
      </main>
    );
  }
  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', color: 'var(--olive-700)' }}>
      <Spinner label="Opening the demo café" />
    </main>
  );
}
