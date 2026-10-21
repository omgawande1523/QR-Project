import { Compass } from 'lucide-react';
import { Button, EmptyState } from '../../components/ui';
import { usePageTitle } from '../../lib/usePageTitle';

export default function NotFound() {
  usePageTitle('Page not found');
  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
      <EmptyState heading="h1" icon={<Compass size={28} />} title="Page not found" action={<Button to="/">Go to the home page</Button>}>
        The link may be old or mistyped. If you scanned a table QR code, please scan it again.
      </EmptyState>
    </main>
  );
}
