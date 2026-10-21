import { Compass } from 'lucide-react';
import { Button, EmptyState } from '../../components/ui';

export default function NotFound() {
  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
      <EmptyState icon={<Compass size={28} />} title="Page not found" action={<Button to="/">Go to the home page</Button>}>
        The link may be old or mistyped. If you scanned a table QR code, please scan it again.
      </EmptyState>
    </main>
  );
}
