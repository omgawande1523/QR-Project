import { Flame, ChefHat, Sparkles, Star } from 'lucide-react';

export function Badge({ tone, icon, children, className = '' }) {
  return (
    <span className={['badge', tone && `badge-${tone}`, className].filter(Boolean).join(' ')}>
      {icon}
      {children}
    </span>
  );
}

const TAG_BADGES = {
  bestseller: { tone: 'bestseller', label: 'Bestseller', Icon: Flame },
  chefs_special: { tone: 'chef', label: "Chef's special", Icon: ChefHat },
  new: { tone: 'new', label: 'New', Icon: Sparkles }
};

// Badges for a menu item's tags (bestseller, chefs_special, new) plus Sold out.
export function ItemBadges({ tags = [], soldOut = false, max = 2 }) {
  return (
    <>
      {soldOut && <Badge tone="soldout">Sold out</Badge>}
      {tags.slice(0, soldOut ? max - 1 : max).map((tag) => {
        const meta = TAG_BADGES[tag];
        if (!meta) return null;
        return <Badge key={tag} tone={meta.tone} icon={<meta.Icon size={12} aria-hidden="true" />}>{meta.label}</Badge>;
      })}
    </>
  );
}

export function VegMark({ isVeg = true }) {
  const label = isVeg ? 'Vegetarian' : 'Non-vegetarian';
  return <span className={`veg-mark ${isVeg ? '' : 'nonveg'}`} role="img" aria-label={label} title={label} />;
}

export function Skeleton({ width = '100%', height = 16, radius, style, className = '' }) {
  return <span className={`skeleton ${className}`} aria-hidden="true" style={{ display: 'block', width, height, borderRadius: radius, ...style }} />;
}

// `heading`: "h1" when the empty state is the whole page (404, menu unavailable), so the page has a title.
export function EmptyState({ icon, title, children, action, heading: Heading = 'h3' }) {
  return (
    <div className="empty-state">
      {icon && <div className="empty-state-icon" aria-hidden="true">{icon}</div>}
      <Heading className="empty-state-title">{title}</Heading>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

export function Spinner({ label = 'Loading' }) {
  return <span className="spinner" role="status" aria-label={label} />;
}

// Read-only star rating, e.g. a guest's feedback.
export function Stars({ rating, size = 16 }) {
  return (
    <span className="stars" role="img" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => <Star key={n} size={size} strokeWidth={1.75} className={n <= rating ? 'is-on' : ''} aria-hidden="true" />)}
    </span>
  );
}
