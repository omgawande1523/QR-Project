import { Heart, Plus } from 'lucide-react';
import { Button, IconButton, QuantityStepper, ItemBadges, VegMark } from './ui';
import { formatPrice } from '../lib/format';
import { responsiveImage } from '../lib/srcset';

// Two cards per row in a column at most 480 px wide (customer.css), so a card is about half the screen.
const CARD_SIZES = '(min-width: 480px) 230px, calc(50vw - 24px)';

// Menu grid card: photo, name, short description, price, veg mark, favourite, badges and a full-width
// Add button that becomes a stepper. Items with sizes or add-ons open the detail screen instead.
// `priority` cards are on screen at once, so their photos load eagerly.
export function FoodCard({ item, quantity = 0, favourite = false, priority = false, onOpen, onAdd, onQuantityChange, onToggleFavourite, bump = false }) {
  const soldOut = !item.available;
  const customisable = (item.variants?.length || 0) > 0 || (item.addOns?.length || 0) > 0;
  const fromPrice = item.variants?.length ? Math.min(...item.variants.map((v) => v.price)) : item.price;

  return (
    <article className={`food-card ${soldOut ? 'is-sold-out' : ''}`}>
      <div className="food-card-media" onClick={onOpen}>
        {item.image
          ? (
            <img
              {...responsiveImage(item.image, { widths: [320, 480, 640], sizes: CARD_SIZES })}
              alt={item.name}
              loading={priority ? 'eager' : 'lazy'}
              // React 18 passes fetchpriority through only in lowercase.
              // eslint-disable-next-line react/no-unknown-property
              fetchpriority={priority ? 'high' : undefined}
              decoding="async"
              width="400"
              height="300"
            />
          )
          : <div style={{ height: '100%' }} />}
        <span className="food-card-veg"><VegMark isVeg={item.isVeg !== false} /></span>
        <div className="food-card-badges"><ItemBadges tags={item.tags} soldOut={soldOut} /></div>
      </div>
      <IconButton
        label={favourite ? `Remove ${item.name} from favourites` : `Add ${item.name} to favourites`}
        className="food-card-fav"
        aria-pressed={favourite}
        onClick={onToggleFavourite}
      >
        <Heart size={18} fill={favourite ? 'currentColor' : 'none'} />
      </IconButton>
      <div className="food-card-body" onClick={onOpen}>
        <h3 className="food-card-name clamp-2">
          {/* The card body also opens the item; stop here so one tap navigates once. */}
          <button type="button" lang={item.nameLang} onClick={(e) => { e.stopPropagation(); onOpen(); }} style={{ textAlign: 'left' }}>{item.name}</button>
        </h3>
        {item.description && <p className="food-card-desc truncate" lang={item.descriptionLang}>{item.description}</p>}
        <p className="food-card-price price">
          {item.variants?.length ? <span className="muted text-xs" style={{ fontWeight: 600 }}>from </span> : null}
          {formatPrice(fromPrice)}
        </p>
      </div>
      <div className="food-card-action">
        {quantity > 0 && !customisable ? (
          <QuantityStepper value={quantity} onChange={onQuantityChange} removable min={0} size="sm" label={`${item.name} quantity`} />
        ) : (
          <Button
            size="sm"
            block
            disabled={soldOut}
            onClick={customisable ? onOpen : onAdd}
            icon={<Plus size={16} />}
            className={bump ? 'bounce' : ''}
          >
            {/* The spoken name starts with the visible words (WCAG 2.5.3), then says which dish:
                "Add Masala Dosa, choose options". Browsers put a space before the hidden span. */}
            {soldOut ? 'Sold out' : quantity > 0 ? `Add more (${quantity})` : 'Add'}
            <span className="sr-only">{customisable && !soldOut ? `${item.name}, choose options` : item.name}</span>
          </Button>
        )}
      </div>
    </article>
  );
}
