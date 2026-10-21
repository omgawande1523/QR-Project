import { Brand } from '../auth/AuthLayout';
import { usePageTitle } from '../../lib/usePageTitle';
import { APP_NAME } from '../../config';
import './legal.css';

// Who to write to about privacy and deletion. Set VITE_CONTACT_EMAIL for the live site (it must match the
// contact email on the Play Store listing); without it the pages point to the contact form on the home page.
export const CONTACT_EMAIL = import.meta.env.VITE_CONTACT_EMAIL || '';

export function ContactLine() {
  return CONTACT_EMAIL
    ? <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
    : <a href="/#contact">the contact form on our home page</a>;
}

// Plain reading layout for the privacy policy and the account-deletion page.
export function LegalLayout({ title, updated, children }) {
  usePageTitle(title);
  return (
    <div className="legal">
      <header className="legal-header"><div className="container"><Brand /></div></header>
      <main className="container legal-body">
        <h1>{title}</h1>
        {updated && <p className="muted">Last updated {updated}</p>}
        {children}
      </main>
      <footer className="container legal-footer muted text-sm">
        © {new Date().getFullYear()} {APP_NAME} · <a href="/privacy">Privacy policy</a> · <a href="/delete-account">Delete your account</a>
      </footer>
    </div>
  );
}
