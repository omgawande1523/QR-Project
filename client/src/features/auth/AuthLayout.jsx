import { Link } from 'react-router';
import { QrCode, Zap, ChefHat, IndianRupee } from 'lucide-react';
import { APP_NAME } from '../../config';
import { usePageTitle } from '../../lib/usePageTitle';
import './auth.css';

const POINTS = [
  { Icon: QrCode, text: 'Guests scan, browse and order from their table' },
  { Icon: Zap, text: 'Orders reach your kitchen instantly' },
  { Icon: IndianRupee, text: 'GST-ready bills, priced by the server' },
  { Icon: ChefHat, text: 'Menu changes show up live on every phone' }
];

export function Brand({ light = false }) {
  return (
    <Link to="/" className={`brand ${light ? 'brand-light' : ''}`} aria-label={`${APP_NAME} home`}>
      <span className="brand-mark" aria-hidden="true"><QrCode size={20} /></span>
      {APP_NAME}
    </Link>
  );
}

export function AuthLayout({ title, subtitle, children, footer }) {
  usePageTitle(title);
  return (
    <div className="auth">
      {/* On wide screens this holds the only link home, so it stays visible to screen readers. */}
      <aside className="auth-aside" aria-label={`About ${APP_NAME}`}>
        <Brand light />
        <div>
          <h2 className="auth-aside-title">Run your restaurant from one screen.</h2>
          <ul className="auth-points">
            {POINTS.map(({ Icon, text }) => (
              <li key={text}><span aria-hidden="true"><Icon size={18} /></span>{text}</li>
            ))}
          </ul>
        </div>
        <p className="auth-aside-foot">Made for Indian restaurants and cafés</p>
      </aside>
      <main className="auth-main">
        <div className="auth-mobile-brand"><Brand /></div>
        <div className="auth-card page-enter">
          <h1 className="auth-title">{title}</h1>
          {subtitle && <p className="muted">{subtitle}</p>}
          {children}
        </div>
        {footer && <p className="auth-footer">{footer}</p>}
      </main>
    </div>
  );
}
