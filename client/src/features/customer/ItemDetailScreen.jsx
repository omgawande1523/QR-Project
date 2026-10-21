import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router';
import { ChevronLeft, Heart, Flame } from 'lucide-react';
import { useCustomer } from './CustomerContext';
import { IconButton, OptionGroup, OptionRow, QuantityStepper, ItemBadges, VegMark, Skeleton, EmptyState, Button, useToast } from '../../components/ui';
import { formatPrice } from '../../lib/format';
import { unitPricePaise, toRupees } from '../../lib/pricing';

const SPICE = ['', 'Mild', 'Medium', 'Hot'];

export function SpiceLevel({ level }) {
  if (!level) return null;
  return (
    <span className="spice" aria-label={`Spice level: ${SPICE[level]}`}>
      {[1, 2, 3].map((n) => <span key={n} className={`spice-dot ${n <= level ? 'on' : ''}`} aria-hidden="true" />)}
      <span>{SPICE[level]}</span>
    </span>
  );
}

export default function ItemDetailScreen() {
  const { itemId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const { restaurantId, menuById, status, addLine, favourites, toggleFavourite } = useCustomer();
  const item = menuById.get(itemId);

  const [variantId, setVariantId] = useState(null);
  const [addOnIds, setAddOnIds] = useState([]);
  const [notes, setNotes] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [expanded, setExpanded] = useState(false);

  // Pre-select the first size so the price is always defined.
  useEffect(() => {
    if (item?.variants?.length && !item.variants.some((v) => v._id === variantId)) setVariantId(item.variants[0]._id);
  }, [item, variantId]);

  const unitPaise = useMemo(() => unitPricePaise(item, variantId || undefined, addOnIds), [item, variantId, addOnIds]);
  const goBack = () => (location.key !== 'default' ? navigate(-1) : navigate(`/menu/${restaurantId}/browse`));

  if (status === 'loading') {
    return (
      <main className="customer-page" aria-busy="true">
        <Skeleton height={300} radius="var(--radius-card)" style={{ marginTop: 72 }} />
        <Skeleton height={28} width="60%" style={{ marginTop: 20 }} />
        <Skeleton height={16} style={{ marginTop: 12 }} />
      </main>
    );
  }

  if (!item) {
    return (
      <main className="customer-page">
        <EmptyState title="Dish not found" action={<Button to={`/menu/${restaurantId}/browse`}>Back to menu</Button>}>
          It may have been removed from the menu.
        </EmptyState>
      </main>
    );
  }

  const soldOut = !item.available;
  const favourite = favourites.has(item._id);
  const longDescription = (item.description || '').length > 140;
  const toggleAddOn = (id) => setAddOnIds((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));

  const add = () => {
    addLine({ itemId: item._id, variantId: variantId || undefined, addOnIds, notes, quantity });
    toast.success(`Added ${quantity} × ${item.name}`);
    goBack();
  };

  return (
    <main className="customer-page detail-page page-enter">
      <header className="page-header">
        <IconButton label="Back" onClick={goBack}><ChevronLeft size={22} /></IconButton>
        <h1>Details</h1>
        <IconButton label={favourite ? 'Remove from favourites' : 'Add to favourites'} aria-pressed={favourite} onClick={() => toggleFavourite(item._id)} className={favourite ? 'is-fav' : ''}>
          <Heart size={20} fill={favourite ? 'currentColor' : 'none'} />
        </IconButton>
      </header>

      <div className="detail-media">
        {item.image && <img src={item.image} alt={item.name} width="800" height="600" />}
        <div className="detail-badges"><ItemBadges tags={item.tags} soldOut={soldOut} max={3} /></div>
      </div>

      <section className="detail-head">
        <div className="row-between" style={{ alignItems: 'flex-start' }}>
          <h2 className="detail-name">{item.name}</h2>
          {item.calories ? (
            <span className="detail-cal"><Flame size={16} aria-hidden="true" /> {item.calories} Cal</span>
          ) : null}
        </div>
        <div className="row wrap" style={{ gap: 'var(--space-3)' }}>
          <VegMark isVeg={item.isVeg !== false} />
          <span className="detail-price price">{formatPrice(unitPaise !== null ? toRupees(unitPaise) : item.price)}</span>
          <SpiceLevel level={item.spiceLevel} />
        </div>
        {item.description && (
          <p className={`detail-desc ${longDescription && !expanded ? 'clamp-3' : ''}`}>
            {item.description}
          </p>
        )}
        {longDescription && (
          <button type="button" className="link-btn" onClick={() => setExpanded((v) => !v)} aria-expanded={expanded}>
            {expanded ? 'Read less' : 'Read more'}
          </button>
        )}
      </section>

      {item.variants?.length > 0 && (
        <section className="detail-section">
          <OptionGroup title="Choose size" hint="Required">
            {item.variants.map((v) => (
              <OptionRow key={v._id} type="radio" name="variant" label={v.name} price={formatPrice(v.price)} checked={variantId === v._id} onChange={() => setVariantId(v._id)} disabled={soldOut} />
            ))}
          </OptionGroup>
        </section>
      )}

      {item.addOns?.length > 0 && (
        <section className="detail-section">
          <OptionGroup title="Add extra" hint="Optional">
            {item.addOns.map((a) => (
              <OptionRow key={a._id} type="checkbox" label={a.name} price={`+ ${formatPrice(a.price)}`} checked={addOnIds.includes(a._id)} onChange={() => toggleAddOn(a._id)} disabled={soldOut} />
            ))}
          </OptionGroup>
        </section>
      )}

      <section className="detail-section">
        <label className="option-group-title" htmlFor="item-notes">Add notes</label>
        <textarea
          id="item-notes"
          className="textarea"
          rows={2}
          maxLength={200}
          placeholder="E.g. less spicy, no onion"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          disabled={soldOut}
        />
      </section>

      <div className="detail-cta">
        <div className={`cta-pill ${soldOut ? 'is-disabled' : ''}`}>
          <button type="button" className="cta-main" onClick={add} disabled={soldOut || unitPaise === null}>
            {soldOut ? 'Sold out' : `Add to cart · ${formatPrice(toRupees((unitPaise || 0) * quantity))}`}
          </button>
          {!soldOut && <QuantityStepper value={quantity} onChange={setQuantity} size="sm" tone="on-primary" label="Quantity" />}
        </div>
      </div>
    </main>
  );
}
