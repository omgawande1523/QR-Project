import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { ChevronLeft, Trash2, ShoppingBag, Plus, StickyNote } from 'lucide-react';
import { useCustomer } from './CustomerContext';
import { Button, IconButton, QuantityStepper, EmptyState, TextField, SelectField, Badge, Card, VegMark, useToast } from '../../components/ui';
import { formatPrice } from '../../lib/format';
import { toRupees } from '../../lib/pricing';
import { errorMessage } from '../../lib/api';
import { responsiveImage } from '../../lib/srcset';

function CartLine({ line, onQuantity, onNotes }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(line.notes || '');
  const options = [line.variant?.name, ...line.addOns.map((a) => a.name)].filter(Boolean).join(' · ');
  const saveNote = () => {
    onNotes(draft.trim());
    setEditing(false);
  };
  return (
    <li className={`cart-line ${line.problem ? 'has-problem' : ''}`}>
      {line.item?.image ? <img {...responsiveImage(line.item.image, { widths: [160, 320], sizes: '64px', fallback: 160 })} alt="" width="64" height="64" loading="lazy" /> : <span className="cart-line-thumb" />}
      <div className="grow">
        <div className="row" style={{ gap: 6 }}>
          {line.item && <VegMark isVeg={line.item.isVeg !== false} />}
          <p className="cart-line-name truncate">{line.item?.name || 'Unavailable item'}</p>
        </div>
        {options && <p className="cart-line-options">{options}</p>}
        {line.problem && <Badge tone="danger">{line.problem}</Badge>}
        {editing ? (
          <div className="row" style={{ marginTop: 6 }}>
            <input className="input" style={{ minHeight: 40 }} value={draft} maxLength={200} onChange={(e) => setDraft(e.target.value)} aria-label="Note for the kitchen" autoFocus onKeyDown={(e) => e.key === 'Enter' && saveNote()} />
            <Button size="sm" onClick={saveNote}>Save</Button>
          </div>
        ) : (
          <button type="button" className="link-btn cart-line-note" onClick={() => setEditing(true)}>
            <StickyNote size={14} aria-hidden="true" /> {line.notes ? `“${line.notes}”` : 'Add note'}
          </button>
        )}
        <div className="row-between" style={{ marginTop: 6 }}>
          <span className="price">{formatPrice(toRupees(line.unitPaise * line.quantity))}</span>
          <QuantityStepper value={line.quantity} onChange={onQuantity} removable min={0} size="sm" label={`${line.item?.name || 'Item'} quantity`} />
        </div>
      </div>
    </li>
  );
}

export default function CartScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const { restaurantId, restaurant, table, setTable, cartLines, cartCount, bill, setLineQuantity, setLineNotes, clearCart, placeOrder, reload, savedCustomer } = useCustomer();
  const [customerName, setCustomerName] = useState(savedCustomer.customerName || '');
  const [customerPhone, setCustomerPhone] = useState(savedCustomer.customerPhone || '');
  const [placing, setPlacing] = useState(false);
  const browse = `/menu/${restaurantId}/browse`;
  const goBack = () => (location.key !== 'default' ? navigate(-1) : navigate(browse));

  const orderable = cartLines.filter((l) => !l.problem);
  const closed = restaurant?.acceptingOrders === false;
  const blocker = closed ? 'The restaurant is not taking orders right now'
    : !table ? 'Choose your table to place the order'
      : orderable.length === 0 ? 'Nothing in your cart can be ordered' : null;

  const submit = async () => {
    setPlacing(true);
    try {
      const order = await placeOrder({ customerName: customerName.trim(), customerPhone: customerPhone.trim() });
      navigate(`/menu/${restaurantId}/orders/${order._id}`, { replace: true, state: { justPlaced: true } });
    } catch (err) {
      toast.error(errorMessage(err, 'Could not place your order'));
      if (['ITEM_UNAVAILABLE', 'ITEM_NOT_FOUND', 'UNKNOWN_VARIANT', 'UNKNOWN_ADD_ON'].includes(err.response?.data?.code)) reload();
    } finally {
      setPlacing(false);
    }
  };

  if (cartCount === 0) {
    return (
      <main className="customer-page page-enter">
        <header className="page-header">
          <IconButton label="Back" onClick={goBack}><ChevronLeft size={22} /></IconButton>
          <h1>Your cart</h1>
          <span />
        </header>
        <EmptyState icon={<ShoppingBag size={30} />} title="Your cart is empty" action={<Button to={browse}>Browse the menu</Button>}>
          Add a few dishes and they will show up here.
        </EmptyState>
      </main>
    );
  }

  return (
    <main className="customer-page cart-page page-enter">
      <header className="page-header">
        <IconButton label="Back" onClick={goBack}><ChevronLeft size={22} /></IconButton>
        <h1>Your cart</h1>
        <IconButton label="Empty cart" variant="flat" onClick={() => { if (window.confirm('Remove everything from your cart?')) clearCart(); }}>
          <Trash2 size={20} />
        </IconButton>
      </header>

      {closed && <div className="notice notice-warning" role="status">The restaurant is not taking orders right now.</div>}

      <Card className="stack-sm">
        <SelectField
          label="Table"
          value={table || ''}
          onChange={(e) => setTable(e.target.value)}
          options={[{ value: '', label: 'Choose your table', disabled: true }, ...(restaurant?.tables || []).map((t) => ({ value: t, label: `Table ${t}` }))]}
        />
      </Card>

      <ul className="cart-lines" aria-label="Items in your cart">
        {cartLines.map((line) => (
          <CartLine key={line.key} line={line} onQuantity={(q) => setLineQuantity(line.key, q)} onNotes={(notes) => setLineNotes(line.key, notes)} />
        ))}
      </ul>
      <Button variant="ghost" to={browse} icon={<Plus size={18} />}>Add more items</Button>

      <Card className="stack-sm" style={{ marginTop: 'var(--space-4)' }}>
        <h2 className="card-title">Your details <span className="muted text-sm" style={{ fontWeight: 500 }}>(optional)</span></h2>
        <div className="form-grid">
          <TextField label="Name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} maxLength={60} autoComplete="name" placeholder="So we can call you" />
          <TextField label="Phone" type="tel" inputMode="tel" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} autoComplete="tel" placeholder="10-digit mobile" />
        </div>
      </Card>

      <Card className="bill" style={{ marginTop: 'var(--space-4)' }} aria-label="Bill">
        <div className="kv"><span>Subtotal</span><span>{formatPrice(bill.subtotal)}</span></div>
        {bill.serviceChargePercent > 0 && <div className="kv"><span>Service charge ({bill.serviceChargePercent}%)</span><span>{formatPrice(bill.serviceCharge)}</span></div>}
        {bill.taxPercent > 0 && <div className="kv"><span>GST ({bill.taxPercent}%)</span><span>{formatPrice(bill.tax)}</span></div>}
        <hr className="divider" />
        <div className="kv kv-total"><span>Total</span><span>{formatPrice(bill.total)}</span></div>
        <p className="muted text-xs" style={{ marginTop: 8 }}>Pay at the counter or to your waiter after your meal.</p>
      </Card>

      <div className="detail-cta">
        {blocker && <p className="cta-hint">{blocker}</p>}
        <Button size="lg" block onClick={submit} loading={placing} disabled={Boolean(blocker)}>
          Place order · {formatPrice(bill.total)}
        </Button>
      </div>
    </main>
  );
}
