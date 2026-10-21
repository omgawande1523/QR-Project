import { useEffect, useState } from 'react';
import { UserPlus, KeyRound, Trash2, Users, Copy, RefreshCw } from 'lucide-react';
import { PageHeader } from './OwnerLayout';
import { Badge, Button, Card, EmptyState, IconButton, Modal, SelectField, Skeleton, Switch, TextField, useToast } from '../../components/ui';
import { api, errorMessage } from '../../lib/api';
import { ROLE_LABEL } from '../../lib/roles';
import { formatDateTime } from '../../lib/format';

const ROLE_HELP = {
  manager: 'Everything except staff accounts: menu, tables, settings, orders',
  waiter: 'Orders board and table requests',
  kitchen: 'Kitchen display only'
};
const ROLE_OPTIONS = ['manager', 'waiter', 'kitchen'].map((value) => ({ value, label: ROLE_LABEL[value] }));

// Readable temporary password: 10 characters without look-alikes, at least one digit.
function generatePassword() {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const values = crypto.getRandomValues(new Uint32Array(9));
  return `${[...values].map((v) => alphabet[v % alphabet.length]).join('')}${2 + (values[0] % 8)}`;
}

async function copy(text, toast) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success('Copied');
  } catch {
    toast.error('Could not copy; please write it down');
  }
}

function AddStaffModal({ onClose, onAdded }) {
  const toast = useToast();
  const [form, setForm] = useState({ name: '', email: '', role: 'waiter', password: generatePassword() });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const save = async () => {
    setSaving(true);
    setErrors({});
    try {
      const res = await api.post('/api/staff', form);
      onAdded(res.data, form.password);
    } catch (err) {
      const details = err.response?.data?.details;
      if (details) setErrors(Object.fromEntries(details.map((d) => [d.field, d.message])));
      else toast.error(errorMessage(err, 'Could not add the staff member'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Add a staff member" footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save} loading={saving}>Add</Button></>}>
      <div className="stack">
        <TextField label="Name" value={form.name} onChange={set('name')} error={errors.name} maxLength={60} autoFocus />
        <TextField label="Email" type="email" value={form.email} onChange={set('email')} error={errors.email} hint="They log in with this email on the normal login page" />
        <SelectField label="Role" value={form.role} onChange={set('role')} options={ROLE_OPTIONS} hint={ROLE_HELP[form.role]} />
        <div className="row" style={{ alignItems: 'flex-end' }}>
          <TextField className="grow" label="Temporary password" value={form.password} onChange={set('password')} error={errors.password} hint="Share it with them; they can change it in Settings" />
          <IconButton label="Generate another password" onClick={() => setForm((f) => ({ ...f, password: generatePassword() }))}><RefreshCw size={18} /></IconButton>
          <IconButton label="Copy password" onClick={() => copy(form.password, toast)}><Copy size={18} /></IconButton>
        </div>
      </div>
    </Modal>
  );
}

export default function StaffPage() {
  const toast = useToast();
  const [staff, setStaff] = useState(null);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    api.get('/api/staff').then((res) => setStaff(res.data)).catch((err) => toast.error(errorMessage(err, 'Could not load staff')));
  }, [toast]);

  const replace = (member) => setStaff((list) => list.map((s) => (s._id === member._id ? member : s)));

  // Optimistic: the switch or role changes at once and is rolled back if the server refuses.
  const update = async (member, patch, message) => {
    replace({ ...member, ...patch });
    try {
      replace((await api.patch(`/api/staff/${member._id}`, patch)).data);
      toast.success(message);
    } catch (err) {
      replace(member);
      toast.error(errorMessage(err));
    }
  };

  const resetPassword = async (member) => {
    const password = generatePassword();
    if (!window.confirm(`Reset ${member.name}'s password? They will be signed out and the new password is copied for you.`)) return;
    try {
      await api.post(`/api/staff/${member._id}/password`, { password });
      await copy(password, toast);
      window.alert(`New password for ${member.name}:\n\n${password}\n\nIt has been copied. Share it with them.`);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const remove = async (member) => {
    if (!window.confirm(`Remove ${member.name}? They will not be able to log in.`)) return;
    try {
      await api.delete(`/api/staff/${member._id}`);
      setStaff((list) => list.filter((s) => s._id !== member._id));
      toast.success('Removed');
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <>
      <PageHeader
        title="Staff"
        subtitle="Give each person their own login. Changing a role or deactivating someone signs them out immediately."
        actions={<Button icon={<UserPlus size={18} />} onClick={() => setAdding(true)}>Add staff</Button>}
      />
      <div className="role-legend">
        {ROLE_OPTIONS.map((r) => <p key={r.value}><Badge tone={r.value === 'manager' ? 'accent' : r.value === 'waiter' ? 'info' : 'warning'}>{r.label}</Badge> {ROLE_HELP[r.value]}</p>)}
      </div>

      {!staff && <Skeleton height={200} radius="var(--radius-card)" />}
      {staff && staff.length === 0 && (
        <EmptyState icon={<Users size={28} />} title="No staff accounts yet" action={<Button icon={<UserPlus size={18} />} onClick={() => setAdding(true)}>Add your first staff member</Button>}>
          Waiters see orders and table requests; the kitchen gets the kitchen display.
        </EmptyState>
      )}
      {staff && staff.length > 0 && (
        <Card className="staff-card">
          <ul className="staff-list">
            {staff.map((member) => (
              <li key={member._id} className={`staff-row ${member.active ? '' : 'is-inactive'}`}>
                <span className="staff-avatar" aria-hidden="true">{member.name.slice(0, 1).toUpperCase()}</span>
                <div className="grow" style={{ minWidth: 0 }}>
                  <strong className="truncate" style={{ display: 'block' }}>{member.name}</strong>
                  <span className="muted text-sm truncate" style={{ display: 'block' }}>{member.email}</span>
                  <span className="muted text-xs">{member.lastLoginAt ? `Last login ${formatDateTime(member.lastLoginAt)}` : 'Has not logged in yet'}</span>
                </div>
                <select className="select staff-role" value={member.role} onChange={(e) => update(member, { role: e.target.value }, `${member.name} is now ${ROLE_LABEL[e.target.value]}`)} aria-label={`Role for ${member.name}`}>
                  {ROLE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
                <Switch checked={member.active} onChange={(on) => update(member, { active: on }, on ? `${member.name} can log in` : `${member.name} is deactivated`)} label={<span className="text-sm">{member.active ? 'Active' : 'Off'}</span>} />
                <IconButton label={`Reset password for ${member.name}`} variant="flat" onClick={() => resetPassword(member)}><KeyRound size={18} /></IconButton>
                <IconButton label={`Remove ${member.name}`} variant="flat" onClick={() => remove(member)}><Trash2 size={18} /></IconButton>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {adding && (
        <AddStaffModal
          onClose={() => setAdding(false)}
          onAdded={(member, password) => {
            setStaff((list) => [...(list || []), member]);
            setAdding(false);
            copy(password, toast);
            toast.success(`${member.name} added. Their password is copied.`);
          }}
        />
      )}
    </>
  );
}
