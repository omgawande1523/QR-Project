import { Heart, Plus } from 'lucide-react';
import { Button, IconButton, QuantityStepper, ItemBadges, VegMark } from './ui';
import { formatPrice } from '../lib/format';

// Menu grid card: photo, name, short description, price, veg mark, favourite, badges and a full-width
// Add button that becomes a stepper. Items with sizes or add-ons open the detail screen instead.
export function FoodCard({ item, quantity = 0, favourite = false, onOpen, onAdd, onQuantityChange, onToggleFavourite, bump = false }) {
  const soldOut = !item.available;
  const customisable = (item.variants?.length || 0) > 0 || (item.addOns?.length || 0) > 0;
  const fromPrice = item.variants?.length ? Math.min(...item.variants.map((v) => v.price)) : item.price;

  return (
    <article className={`food-card ${soldOut ? 'is-sold-out' : ''}`}>
      <div className="food-card-media" onClick={onOpen}>
        {item.image
          ? <img src={item.image} alt={item.name} loading="lazy" decoding="async" width="400" height="300" />
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
          <button type="button" onClick={(e) => { e.stopPropagation(); onOpen(); }} style={{ textAlign: 'left' }}>{item.name}</button>
        </h3>
        {item.description && <p className="food-card-desc truncate">{item.description}</p>}
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
            aria-label={soldOut ? `${item.name} is sold out` : customisable ? `Choose options for ${item.name}` : `Add ${item.name}`}
          >
            {soldOut ? 'Sold out' : quantity > 0 ? `Add more (${quantity})` : 'Add'}
          </Button>
        )}
      </div>
    </article>
  );
}
