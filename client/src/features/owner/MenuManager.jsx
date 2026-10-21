import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, ChevronUp, ChevronDown, Check, X, UtensilsCrossed, FolderPlus, FolderCog } from 'lucide-react';
import { useOwner } from './OwnerContext';
import { PageHeader } from './OwnerLayout';
import { ItemEditor } from './ItemEditor';
import { BottomSheet, Button, Card, Chip, EmptyState, IconButton, ItemBadges, SearchBar, Skeleton, Switch, VegMark, useToast } from '../../components/ui';
import { api, errorMessage } from '../../lib/api';
import { formatPrice } from '../../lib/format';

function CategoryPanel({ categories, counts, selected, onSelect, onReorder, onRename, onDelete, onAdd, className = '' }) {
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState('');
  const [adding, setAdding] = useState('');

  const startEdit = (name) => { setEditing(name); setDraft(name); };
  const commit = async () => {
    const to = draft.trim();
    if (to && to !== editing) await onRename(editing, to);
    setEditing(null);
  };

  return (
    <Card className={`category-panel ${className}`}>
      <h2 className="card-title">Categories</h2>
      <ul className="category-list">
        <li>
          <button type="button" className={`category-row ${selected === 'all' ? 'active' : ''}`} onClick={() => onSelect('all')}>
            <span className="grow">All dishes</span><span className="muted text-sm">{counts.all}</span>
          </button>
        </li>
        {categories.map((name, i) => (
          <li key={name} className="category-item">
            {editing === name ? (
              <div className="row" style={{ gap: 4 }}>
                <input className="input" style={{ minHeight: 40 }} value={draft} maxLength={50} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(null); }} aria-label={`Rename ${name}`} autoFocus />
                <IconButton label="Save name" variant="flat" onClick={commit}><Check size={18} /></IconButton>
                <IconButton label="Cancel" variant="flat" onClick={() => setEditing(null)}><X size={18} /></IconButton>
              </div>
            ) : (
              <>
                <button type="button" className={`category-row ${selected === name ? 'active' : ''}`} onClick={() => onSelect(name)}>
                  <span className="grow truncate">{name}</span><span className="muted text-sm">{counts[name] || 0}</span>
                </button>
                <div className="category-actions">
                  <IconButton label={`Move ${name} up`} variant="flat" disabled={i === 0} onClick={() => onReorder(i, -1)}><ChevronUp size={16} /></IconButton>
                  <IconButton label={`Move ${name} down`} variant="flat" disabled={i === categories.length - 1} onClick={() => onReorder(i, 1)}><ChevronDown size={16} /></IconButton>
                  <IconButton label={`Rename ${name}`} variant="flat" onClick={() => startEdit(name)}><Pencil size={16} /></IconButton>
                  <IconButton label={counts[name] ? `${name} has dishes; move them first` : `Delete ${name}`} variant="flat" disabled={Boolean(counts[name])} onClick={() => onDelete(name)}><Trash2 size={16} /></IconButton>
                </div>
              </>
            )}
          </li>
        ))}
      </ul>
      <form className="row" style={{ gap: 6 }} onSubmit={(e) => { e.preventDefault(); if (adding.trim()) { onAdd(adding.trim()); setAdding(''); } }}>
        <input className="input" style={{ minHeight: 44 }} placeholder="New category" value={adding} maxLength={50} onChange={(e) => setAdding(e.target.value)} aria-label="New category name" />
        <IconButton label="Add category" variant="primary" type="submit" disabled={!adding.trim()}><FolderPlus size={18} /></IconButton>
      </form>
    </Card>
  );
}

export default function MenuManager() {
  const { userId, profile, saveProfile, loadProfile, subscribe } = useOwner();
  const toast = useToast();
  const [items, setItems] = useState(null);
  const [category, setCategory] = useState('all');
  const [query, setQuery] = useState('');
  const [availability, setAvailability] = useState('all');
  const [selected, setSelected] = useState(new Set());
  const [editor, setEditor] = useState(null); // null | 'new' | item
  const [categorySheet, setCategorySheet] = useState(false);

  useEffect(() => {
    api.get(`/api/menu/${userId}`).then((res) => setItems(res.data)).catch((err) => toast.error(errorMessage(err, 'Could not load the menu')));
  }, [userId, toast]);

  // Stay in sync with changes made on another device (or by bulk actions).
  const upsert = useCallback((item) => setItems((list) => (list ? (list.some((i) => i._id === item._id) ? list.map((i) => (i._id === item._id ? item : i)) : [...list, item]) : list)), []);
  useEffect(() => subscribe('menuUpdated', upsert), [subscribe, upsert]);
  useEffect(() => subscribe('menuItemDeleted', ({ _id }) => setItems((list) => list?.filter((i) => i._id !== _id))), [subscribe]);

  const categories = useMemo(() => {
    const used = [...new Set((items || []).map((i) => i.category).filter(Boolean))];
    const ordered = profile?.categories || [];
    return [...ordered, ...used.filter((c) => !ordered.includes(c))];
  }, [items, profile]);

  const counts = useMemo(() => {
    const map = { all: items?.length || 0 };
    (items || []).forEach((i) => { if (i.category) map[i.category] = (map[i.category] || 0) + 1; });
    return map;
  }, [items]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (items || [])
      .filter((i) => category === 'all' || i.category === category)
      .filter((i) => availability === 'all' || (availability === 'available' ? i.available : !i.available))
      .filter((i) => !q || `${i.name} ${i.description || ''}`.toLowerCase().includes(q))
      .sort((a, b) => categories.indexOf(a.category) - categories.indexOf(b.category) || a.name.localeCompare(b.name));
  }, [items, category, availability, query, categories]);

  const saveCategories = (list) => saveProfile({ categories: list }, { silent: true }).catch((err) => toast.error(errorMessage(err)));

  const reorder = (index, delta) => {
    const list = [...categories];
    const [moved] = list.splice(index, 1);
    list.splice(index + delta, 0, moved);
    saveCategories(list);
  };

  const rename = async (from, to) => {
    try {
      await api.post('/api/menu/categories/rename', { from, to });
      await loadProfile();
      if (category === from) setCategory(to);
      toast.success(`Renamed to ${to}`);
    } catch (err) {
      toast.error(errorMessage(err, 'Could not rename'));
    }
  };

  const toggle = async (item, available) => {
    upsert({ ...item, available });
    try {
      upsert((await api.put(`/api/menu/${item._id}`, { available })).data);
    } catch (err) {
      upsert(item);
      toast.error(errorMessage(err, 'Could not update availability'));
    }
  };

  const bulk = async (available) => {
    try {
      const res = await api.patch('/api/menu/availability', { ids: [...selected], available });
      res.data.items.forEach(upsert);
      toast.success(`${res.data.updated} dish${res.data.updated === 1 ? '' : 'es'} marked ${available ? 'available' : 'sold out'}`);
      setSelected(new Set());
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const remove = async (item) => {
    if (!window.confirm(`Delete ${item.name}? This cannot be undone.`)) return;
    try {
      await api.delete(`/api/menu/${item._id}`);
      setItems((list) => list.filter((i) => i._id !== item._id));
      toast.success('Dish deleted');
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const panelProps = {
    categories,
    counts,
    selected: category,
    onSelect: setCategory,
    onReorder: reorder,
    onRename: rename,
    onDelete: (name) => saveCategories(categories.filter((c) => c !== name)),
    onAdd: (name) => (categories.some((c) => c.toLowerCase() === name.toLowerCase()) ? toast.error('That category already exists') : saveCategories([...categories, name]))
  };

  const toggleSelect = (id) => setSelected((set) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const allVisibleSelected = visible.length > 0 && visible.every((i) => selected.has(i._id));

  return (
    <>
      <PageHeader title="Menu" subtitle="Changes appear on customer phones immediately." actions={<Button icon={<Plus size={18} />} onClick={() => setEditor('new')}>Add dish</Button>} />

      <div className="menu-manager">
        <CategoryPanel {...panelProps} className="is-desktop" />

        <div className="stack" style={{ minWidth: 0 }}>
          <div className="category-chips">
            <div className="chip-row" role="group" aria-label="Categories">
              <Chip active={category === 'all'} onClick={() => setCategory('all')}>All {counts.all}</Chip>
              {categories.map((c) => <Chip key={c} active={category === c} onClick={() => setCategory(c)}>{c} {counts[c] || 0}</Chip>)}
            </div>
            <Button size="sm" variant="secondary" icon={<FolderCog size={16} />} onClick={() => setCategorySheet(true)}>Manage categories</Button>
          </div>
          <div className="menu-toolbar">
            <div className="grow" style={{ minWidth: 220 }}><SearchBar value={query} onChange={setQuery} placeholder="Search dishes" label="Search dishes" /></div>
            <div className="chip-row">
              {[['all', 'All'], ['available', 'Available'], ['soldout', 'Sold out']].map(([value, label]) => (
                <Chip key={value} active={availability === value} onClick={() => setAvailability(value)}>{label}</Chip>
              ))}
            </div>
          </div>

          {selected.size > 0 && (
            <div className="bulk-bar" role="region" aria-label="Bulk actions">
              <strong>{selected.size} selected</strong>
              <Button size="sm" variant="dark" onClick={() => bulk(false)}>Mark sold out</Button>
              <Button size="sm" variant="secondary" onClick={() => bulk(true)}>Mark available</Button>
              <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear</Button>
            </div>
          )}

          {!items && <Skeleton height={320} radius="var(--radius-card)" />}
          {items && visible.length === 0 && (
            <EmptyState icon={<UtensilsCrossed size={28} />} title={items.length ? 'No dishes match' : 'Your menu is empty'} action={<Button icon={<Plus size={18} />} onClick={() => setEditor('new')}>Add a dish</Button>}>
              {items.length ? 'Try another search or filter.' : 'Add your first dish; customers can order it right away.'}
            </EmptyState>
          )}
          {visible.length > 0 && (
            <Card className="items-card">
              <label className="select-all">
                <input type="checkbox" checked={allVisibleSelected} onChange={() => setSelected(allVisibleSelected ? new Set() : new Set(visible.map((i) => i._id)))} />
                Select all {visible.length}
              </label>
              <ul className="item-rows">
                {visible.map((item) => (
                  <li key={item._id} className={`item-row ${item.available ? '' : 'is-sold-out'}`}>
                    <input type="checkbox" checked={selected.has(item._id)} onChange={() => toggleSelect(item._id)} aria-label={`Select ${item.name}`} />
                    {item.image ? <img src={item.image} alt="" width="56" height="56" loading="lazy" /> : <span className="item-thumb" />}
                    <div className="grow" style={{ minWidth: 0 }}>
                      <div className="row" style={{ gap: 6 }}>
                        <VegMark isVeg={item.isVeg !== false} />
                        <strong className="truncate">{item.name}</strong>
                      </div>
                      <div className="row wrap" style={{ gap: 6, marginTop: 4 }}>
                        <span className="muted text-xs">{item.category || 'No category'}</span>
                        <ItemBadges tags={item.tags} max={3} />
                        {item.variants?.length > 0 && <span className="muted text-xs">{item.variants.length} sizes</span>}
                        {item.addOns?.length > 0 && <span className="muted text-xs">{item.addOns.length} add-ons</span>}
                      </div>
                    </div>
                    <span className="price item-price">{item.variants?.length ? `from ${formatPrice(Math.min(...item.variants.map((v) => v.price)))}` : formatPrice(item.price)}</span>
                    <Switch checked={item.available} onChange={(v) => toggle(item, v)} label={<span className="sr-only">{item.name} available</span>} />
                    <IconButton label={`Edit ${item.name}`} variant="flat" onClick={() => setEditor(item)}><Pencil size={18} /></IconButton>
                    <IconButton label={`Delete ${item.name}`} variant="flat" onClick={() => remove(item)}><Trash2 size={18} /></IconButton>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>

      <BottomSheet open={categorySheet} onClose={() => setCategorySheet(false)} title="Categories">
        <CategoryPanel {...panelProps} onSelect={(c) => { setCategory(c); setCategorySheet(false); }} className="in-sheet" />
      </BottomSheet>

      {editor && (
        <ItemEditor
          item={editor === 'new' ? null : editor}
          categories={categories}
          defaultCategory={category !== 'all' ? category : ''}
          onClose={() => setEditor(null)}
          onSaved={(saved) => { upsert(saved); setEditor(null); loadProfile().catch(() => {}); }}
        />
      )}
    </>
  );
}
