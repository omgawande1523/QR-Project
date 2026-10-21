import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { ShoppingBag, Share2, SearchX, ChevronRight, Leaf, Heart, EyeOff } from 'lucide-react';
import { useCustomer, lineKey } from './CustomerContext';
import { FoodCard } from '../../components/FoodCard';
import { BottomSheet, Button, Chip, IconButton, SearchBar, Skeleton, EmptyState, Switch, Badge, useToast } from '../../components/ui';
import { STATUS_LABEL } from '../../lib/orderStatus';

const SORTS = [
  { value: 'recommended', label: 'Recommended' },
  { value: 'price-asc', label: 'Price: low to high' },
  { value: 'price-desc', label: 'Price: high to low' }
];
const DEFAULT_FILTERS = { vegOnly: false, favouritesOnly: false, hideSoldOut: false, sort: 'recommended' };
const lowestPrice = (item) => (item.variants?.length ? Math.min(...item.variants.map((v) => v.price)) : item.price);

function MenuSkeleton() {
  return (
    <div className="menu-grid" aria-hidden="true">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="food-card">
          <Skeleton height={130} radius="var(--radius-card) var(--radius-card) 0 0" />
          <div style={{ padding: 12 }}><Skeleton height={16} width="80%" /><Skeleton height={12} style={{ marginTop: 8 }} /><Skeleton height={36} radius="var(--radius-pill)" style={{ marginTop: 12 }} /></div>
        </div>
      ))}
    </div>
  );
}

export default function MenuScreen() {
  const { restaurantId, restaurant, menu, status, table, cartCount, cartBump, cartLines, addLine, setLineQuantity, favourites, toggleFavourite, activeOrders } = useCustomer();
  const navigate = useNavigate();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const searchRef = useRef(null);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [filterOpen, setFilterOpen] = useState(false);
  const [bumped, setBumped] = useState(null);

  // The bottom nav's Search tab links here with ?focus=search.
  useEffect(() => {
    if (params.get('focus') === 'search') {
      searchRef.current?.focus();
      params.delete('focus');
      setParams(params, { replace: true });
    }
  }, [params, setParams]);

  const categories = useMemo(() => {
    const used = [...new Set(menu.map((i) => i.category).filter(Boolean))];
    const ordered = (restaurant?.categories || []).filter((c) => used.includes(c));
    return [...ordered, ...used.filter((c) => !ordered.includes(c))];
  }, [menu, restaurant]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = menu.filter((item) => {
      if (category !== 'all' && item.category !== category) return false;
      if (filters.vegOnly && item.isVeg === false) return false;
      if (filters.favouritesOnly && !favourites.has(item._id)) return false;
      if (filters.hideSoldOut && !item.available) return false;
      if (q && !`${item.name} ${item.description || ''} ${item.category || ''}`.toLowerCase().includes(q)) return false;
      return true;
    });
    if (filters.sort === 'price-asc') list = [...list].sort((a, b) => lowestPrice(a) - lowestPrice(b));
    if (filters.sort === 'price-desc') list = [...list].sort((a, b) => lowestPrice(b) - lowestPrice(a));
    return list;
  }, [menu, category, filters, favourites, query]);

  const grouped = category === 'all' && !query && filters.sort === 'recommended';
  const filtersActive = JSON.stringify(filters) !== JSON.stringify(DEFAULT_FILTERS);
  const plainQuantity = (itemId) => cartLines.find((l) => l.key === lineKey({ itemId }))?.quantity || 0;
  const open = (item) => navigate(`/menu/${restaurantId}/item/${item._id}`);

  const add = (item) => {
    addLine({ itemId: item._id });
    setBumped(item._id);
    setTimeout(() => setBumped(null), 450);
  };

  const share = async () => {
    const url = `${window.location.origin}/menu/${restaurantId}`;
    try {
      if (navigator.share) await navigator.share({ title: restaurant.restaurantName, url });
      else {
        await navigator.clipboard.writeText(url);
        toast.success('Menu link copied');
      }
    } catch {
      // share sheet dismissed
    }
  };

  const renderGrid = (items) => (
    <div className="menu-grid">
      {items.map((item) => (
        <FoodCard
          key={item._id}
          item={item}
          quantity={plainQuantity(item._id)}
          favourite={favourites.has(item._id)}
          bump={bumped === item._id}
          onOpen={() => open(item)}
          onAdd={() => add(item)}
          onQuantityChange={(q) => setLineQuantity(lineKey({ itemId: item._id }), q)}
          onToggleFavourite={() => toggleFavourite(item._id)}
        />
      ))}
    </div>
  );

  const latestActive = activeOrders[0];

  return (
    <main className="customer-page menu-page page-enter">
      <header className="menu-header">
        {restaurant?.profilePicture && <img className="menu-logo" src={restaurant.profilePicture} alt="" width="44" height="44" />}
        <div className="grow">
          <h1 className="menu-title truncate">{restaurant?.restaurantName || <Skeleton width={160} height={22} />}</h1>
          {table && <p className="menu-subtitle">Table {table}</p>}
        </div>
        <IconButton label="Share menu" onClick={share}><Share2 size={20} /></IconButton>
        <IconButton label="Cart" to={`/menu/${restaurantId}/cart`} count={cartCount} key={cartBump} className={cartBump ? 'pop' : ''}>
          <ShoppingBag size={20} />
        </IconButton>
      </header>

      {restaurant && restaurant.acceptingOrders === false && (
        <div className="notice notice-warning" role="status">This restaurant is not taking orders right now. You can still browse the menu.</div>
      )}

      {latestActive && (
        <button type="button" className="order-banner" onClick={() => navigate(`/menu/${restaurantId}/orders/${latestActive._id}`)}>
          <span className="order-banner-dot" aria-hidden="true" />
          <span className="grow">Your order is <strong>{STATUS_LABEL[latestActive.status]}</strong></span>
          <span className="order-banner-link">Track <ChevronRight size={16} aria-hidden="true" /></span>
        </button>
      )}

      <SearchBar
        inputRef={searchRef}
        value={query}
        onChange={setQuery}
        placeholder="Search dishes"
        label="Search dishes"
        onFilter={() => setFilterOpen(true)}
        filterActive={filtersActive}
      />

      <div className="menu-chips">
        <div className="chip-row" role="group" aria-label="Categories">
          <Chip active={category === 'all'} onClick={() => setCategory('all')}>All</Chip>
          {categories.map((c) => <Chip key={c} active={category === c} onClick={() => setCategory(c)}>{c}</Chip>)}
        </div>
      </div>

      {status === 'loading' && <MenuSkeleton />}

      {status === 'ready' && visible.length === 0 && (
        <EmptyState
          icon={<SearchX size={30} />}
          title="No dishes found"
          action={<Button variant="secondary" onClick={() => { setQuery(''); setCategory('all'); setFilters(DEFAULT_FILTERS); }}>Clear search and filters</Button>}
        >
          Try another word or remove a filter.
        </EmptyState>
      )}

      {status === 'ready' && visible.length > 0 && (grouped
        ? categories.concat(visible.some((i) => !i.category) ? [''] : []).map((c) => {
          const items = visible.filter((i) => (i.category || '') === c);
          if (!items.length) return null;
          return (
            <section key={c || 'other'} className="menu-section" aria-labelledby={`cat-${c || 'other'}`}>
              <h2 id={`cat-${c || 'other'}`} className="menu-section-title">{c || 'More'} <span className="muted">{items.length}</span></h2>
              {renderGrid(items)}
            </section>
          );
        })
        : <section className="menu-section">{renderGrid(visible)}</section>)}

      <BottomSheet open={filterOpen} onClose={() => setFilterOpen(false)} title="Filters">
        <div className="stack">
          <Switch checked={filters.vegOnly} onChange={(v) => setFilters((f) => ({ ...f, vegOnly: v }))} label={<span className="row"><Leaf size={18} aria-hidden="true" /> Veg only</span>} />
          <Switch checked={filters.favouritesOnly} onChange={(v) => setFilters((f) => ({ ...f, favouritesOnly: v }))} label={<span className="row"><Heart size={18} aria-hidden="true" /> Favourites only {favourites.size > 0 && <Badge>{favourites.size}</Badge>}</span>} />
          <Switch checked={filters.hideSoldOut} onChange={(v) => setFilters((f) => ({ ...f, hideSoldOut: v }))} label={<span className="row"><EyeOff size={18} aria-hidden="true" /> Hide sold out</span>} />
          <div>
            <p className="option-group-title">Sort by</p>
            <div className="chip-row wrap">
              {SORTS.map((s) => <Chip key={s.value} active={filters.sort === s.value} onClick={() => setFilters((f) => ({ ...f, sort: s.value }))}>{s.label}</Chip>)}
            </div>
          </div>
          <div className="row">
            <Button variant="secondary" className="grow" onClick={() => setFilters(DEFAULT_FILTERS)}>Reset</Button>
            <Button className="grow" onClick={() => setFilterOpen(false)}>Show {visible.length} dishes</Button>
          </div>
        </div>
      </BottomSheet>
    </main>
  );
}
