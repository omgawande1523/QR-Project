import { useState } from 'react';
import { Link } from 'react-router';
import { ArrowRight, Check, Play, BellRing, Menu as MenuIcon, X, Send } from 'lucide-react';
import { Brand } from '../auth/AuthLayout';
import { Button, Card, TextField, useToast } from '../../components/ui';
import { api, errorMessage } from '../../lib/api';
import { APP_NAME } from '../../config';
import { FEATURES, STEPS, PLANS, FAQ } from './content';
import phoneMenu from '../../assets/landing/phone-menu.webp';
import phoneWelcome from '../../assets/landing/phone-welcome.webp';
import './landing.css';

const NAV = [
  { href: '#features', label: 'Features' },
  { href: '#how', label: 'How it works' },
  { href: '#pricing', label: 'Pricing' },
  { href: '#faq', label: 'FAQ' }
];

function Phone({ src, alt, className = '' }) {
  return (
    <div className={`phone ${className}`}>
      <div className="phone-notch" aria-hidden="true" />
      <img src={src} alt={alt} width="390" height="844" />
    </div>
  );
}

function ContactForm() {
  const toast = useToast();
  const [form, setForm] = useState({ name: '', email: '', phone: '', restaurantName: '', message: '' });
  const [errors, setErrors] = useState({});
  const [sent, setSent] = useState('');
  const [sending, setSending] = useState(false);
  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setSending(true);
    setErrors({});
    try {
      const res = await api.post('/api/public/contact', form);
      setSent(res.data.message);
    } catch (err) {
      const details = err.response?.data?.details;
      if (details) setErrors(Object.fromEntries(details.map((d) => [d.field, d.message])));
      else toast.error(errorMessage(err, 'Could not send your message'));
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <Card className="contact-done" role="status">
        <Check size={32} aria-hidden="true" />
        <h3>Message sent</h3>
        <p className="muted">{sent}</p>
      </Card>
    );
  }

  return (
    <Card as="form" className="stack" onSubmit={submit} noValidate>
      <div className="form-grid">
        <TextField label="Your name" value={form.name} onChange={set('name')} error={errors.name} autoComplete="name" required />
        <TextField label="Email" type="email" value={form.email} onChange={set('email')} error={errors.email} autoComplete="email" required />
        <TextField label="Phone (optional)" type="tel" value={form.phone} onChange={set('phone')} error={errors.phone} autoComplete="tel" />
        <TextField label="Restaurant (optional)" value={form.restaurantName} onChange={set('restaurantName')} error={errors.restaurantName} />
      </div>
      <TextField label="How can we help?" multiline rows={4} value={form.message} onChange={set('message')} error={errors.message} required />
      <div><Button type="submit" loading={sending} icon={<Send size={18} />}>Send message</Button></div>
    </Card>
  );
}

export default function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const year = new Date().getFullYear();

  return (
    <div className="landing">
      <header className="landing-nav">
        <div className="container landing-nav-inner">
          <Brand />
          <nav className={`landing-links ${menuOpen ? 'is-open' : ''}`} aria-label="Sections">
            {NAV.map((item) => <a key={item.href} href={item.href} onClick={() => setMenuOpen(false)}>{item.label}</a>)}
            <Link to="/login" className="landing-login">Log in</Link>
          </nav>
          <div className="row" style={{ gap: 8 }}>
            <Button size="sm" variant="accent" to="/demo" className="hide-xs">Try live demo</Button>
            <Button size="sm" to="/register">Start free</Button>
            <button type="button" className="icon-btn landing-burger" aria-label={menuOpen ? 'Close menu' : 'Open menu'} aria-expanded={menuOpen} onClick={() => setMenuOpen((v) => !v)}>
              {menuOpen ? <X size={20} /> : <MenuIcon size={20} />}
            </button>
          </div>
        </div>
      </header>

      <main>
        <section className="hero">
          <div className="container hero-inner">
            <div className="hero-copy">
              <p className="eyebrow">QR menu &amp; table ordering for Indian restaurants</p>
              <h1>Your menu on every table. Orders straight to your kitchen.</h1>
              <p className="hero-sub">Guests scan, order and track from their phones. You get a live orders board, GST-ready bills and a menu you can change in seconds.</p>
              <div className="row wrap">
                <Button size="lg" variant="accent" to="/demo" icon={<Play size={18} />}>Try live demo</Button>
                <Button size="lg" to="/register" iconRight={<ArrowRight size={18} />}>Start free</Button>
              </div>
              <ul className="hero-points">
                <li><Check size={16} aria-hidden="true" /> No app for guests</li>
                <li><Check size={16} aria-hidden="true" /> Set up in minutes</li>
                <li><Check size={16} aria-hidden="true" /> 0% commission</li>
              </ul>
            </div>
            <div className="hero-visual" aria-hidden="true">
              <Phone src={phoneWelcome} alt="" className="phone-back" />
              <Phone src={phoneMenu} alt="" className="phone-front" />
              <div className="float-card">
                <span className="float-icon"><BellRing size={18} /></span>
                <div>
                  <strong>New order · Table 4</strong>
                  <p>2× Masala Dosa, 1× Filter Coffee</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="section">
          <div className="container">
            <div className="section-head">
              <p className="eyebrow">Features</p>
              <h2>Everything a busy floor needs</h2>
              <p className="muted">Built for dine-in: from the first scan to the final bill.</p>
            </div>
            <div className="feature-grid">
              {FEATURES.map(({ Icon, title, text }) => (
                <Card key={title} className="feature">
                  <span className="feature-icon" aria-hidden="true"><Icon size={22} /></span>
                  <h3>{title}</h3>
                  <p className="muted">{text}</p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section id="how" className="section section-ink">
          <div className="container">
            <div className="section-head">
              <p className="eyebrow">How it works</p>
              <h2>Live in three steps</h2>
            </div>
            <ol className="steps">
              {STEPS.map((step, i) => (
                <li key={step.title} className="step">
                  <span className="step-number">{i + 1}</span>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="pricing" className="section">
          <div className="container">
            <div className="section-head">
              <p className="eyebrow">Pricing</p>
              <h2>Simple plans, no commission</h2>
              <p className="muted">Prices in ₹, excluding GST. Cancel anytime.</p>
            </div>
            <div className="plan-grid">
              {PLANS.map((plan) => (
                <Card key={plan.name} className={`plan ${plan.featured ? 'is-featured' : ''}`}>
                  {plan.featured && <span className="plan-tag">Most popular</span>}
                  <h3>{plan.name}</h3>
                  <p className="muted">{plan.blurb}</p>
                  <p className="plan-price"><span>{plan.price}</span> {plan.period}</p>
                  <ul className="plan-features">
                    {plan.features.map((f) => <li key={f}><Check size={16} aria-hidden="true" /> {f}</li>)}
                  </ul>
                  <Button block variant={plan.featured ? 'primary' : 'secondary'} to={plan.cta === 'Talk to us' ? undefined : '/register'} href={plan.cta === 'Talk to us' ? '#contact' : undefined}>{plan.cta}</Button>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="section demo-band">
          <div className="container demo-band-inner">
            <div>
              <h2>See it from your guest's side</h2>
              <p>Open our demo café, order a dish and watch it arrive on the dashboard.</p>
            </div>
            <Button size="lg" variant="accent" to="/demo" icon={<Play size={18} />}>Try live demo</Button>
          </div>
        </section>

        <section id="faq" className="section">
          <div className="container faq-layout">
            <div className="section-head" style={{ textAlign: 'left', marginInline: 0 }}>
              <p className="eyebrow">FAQ</p>
              <h2>Questions, answered</h2>
              <p className="muted">Anything else? <a href="#contact">Send us a message</a>.</p>
            </div>
            <div className="faq-list">
              {FAQ.map((item) => (
                <details key={item.q} className="faq">
                  <summary>{item.q}</summary>
                  <p>{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section id="contact" className="section section-cream">
          <div className="container contact-layout">
            <div className="section-head" style={{ textAlign: 'left', marginInline: 0 }}>
              <p className="eyebrow">Contact</p>
              <h2>Talk to us</h2>
              <p className="muted">Tell us about your restaurant and we will help you get set up. We reply within one working day.</p>
            </div>
            <ContactForm />
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="container landing-footer-inner">
          <Brand light />
          <nav className="row wrap" aria-label="Footer">
            {NAV.map((item) => <a key={item.href} href={item.href}>{item.label}</a>)}
            <Link to="/login">Log in</Link>
            <Link to="/register">Start free</Link>
          </nav>
          <p>© {year} {APP_NAME}. Made in India.</p>
        </div>
      </footer>
    </div>
  );
}
