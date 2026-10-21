import { useState } from 'react';
import { ConciergeBell, GlassWater, Utensils, Receipt } from 'lucide-react';
import { BottomSheet, SelectField, useToast } from '../../components/ui';
import { errorMessage } from '../../lib/api';
import { useCustomer } from './CustomerContext';

const REQUESTS = [
  { type: 'Waiter', label: 'Call waiter', Icon: ConciergeBell },
  { type: 'Water', label: 'Water', Icon: GlassWater },
  { type: 'Cutlery', label: 'Cutlery', Icon: Utensils },
  { type: 'Bill', label: 'Ask for bill', Icon: Receipt }
];

export function CallWaiterSheet({ open, onClose }) {
  const { restaurant, table, setTable, requestService } = useCustomer();
  const toast = useToast();
  const [sending, setSending] = useState(null);

  const send = async (type, label) => {
    if (!table) return;
    setSending(type);
    try {
      await requestService(type);
      if (navigator.vibrate) navigator.vibrate([60, 40, 60]);
      toast.success(`${label} requested for table ${table}`);
      onClose();
    } catch (err) {
      toast.error(errorMessage(err, 'Could not send your request'));
    } finally {
      setSending(null);
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="How can we help?">
      {!table && (
        <SelectField
          label="Your table"
          value=""
          onChange={(e) => setTable(e.target.value)}
          options={[{ value: '', label: 'Choose your table', disabled: true }, ...(restaurant?.tables || []).map((t) => ({ value: t, label: `Table ${t}` }))]}
        />
      )}
      <div className="waiter-grid">
        {REQUESTS.map(({ type, label, Icon }) => (
          <button key={type} type="button" className="waiter-option" disabled={!table || sending !== null} onClick={() => send(type, label)}>
            <span className="waiter-option-icon" aria-hidden="true">
              {sending === type ? <span className="spinner" /> : <Icon size={24} />}
            </span>
            {label}
          </button>
        ))}
      </div>
      {table && <p className="muted text-sm" style={{ textAlign: 'center', marginTop: 'var(--space-3)' }}>Table {table}</p>}
    </BottomSheet>
  );
}
