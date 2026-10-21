import { useState } from 'react';
import { Plus, X, Languages } from 'lucide-react';
import { Button, Chip, Modal, Switch, TextField, IconButton, useToast } from '../../components/ui';
import { api, errorMessage } from '../../lib/api';
import { ImagePicker } from '../../components/ImagePicker';

const TAGS = [
  { value: 'bestseller', label: 'Bestseller' },
  { value: 'chefs_special', label: "Chef's special" },
  { value: 'new', label: 'New' }
];
const SPICE = ['None', 'Mild', 'Medium', 'Hot'];
const NEW_CATEGORY = '__new__';

const emptyItem = (category) => ({
  name: '', description: '', category: category || '', price: '', image: '', available: true, isVeg: true,
  tags: [], spiceLevel: 0, calories: '', variants: [], addOns: [], translations: emptyTranslations()
});
const TRANSLATION_LANGUAGES = [{ code: 'hi', label: 'Hindi', native: 'हिंदी' }, { code: 'mr', label: 'Marathi', native: 'मराठी' }];
function emptyTranslations(existing = {}) {
  return Object.fromEntries(TRANSLATION_LANGUAGES.map(({ code }) => [code, { name: existing[code]?.name || '', description: existing[code]?.description || '' }]));
}

// Optional Hindi / Marathi name and description; guests switch the menu language on their phone.
function TranslationsEditor({ value, onChange, errors, englishName }) {
  const [lang, setLang] = useState('hi');
  const filled = TRANSLATION_LANGUAGES.filter(({ code }) => value[code].name || value[code].description).length;
  const update = (field, text) => onChange({ ...value, [lang]: { ...value[lang], [field]: text } });
  const current = TRANSLATION_LANGUAGES.find((l) => l.code === lang);
  return (
    <details className="translations-editor" open={filled > 0}>
      <summary><Languages size={16} aria-hidden="true" /> Hindi and Marathi <span className="muted">{filled ? `(${filled} of 2 added)` : '(optional)'}</span></summary>
      <div className="stack" style={{ marginTop: 'var(--space-3)' }}>
        <div className="segmented" role="group" aria-label="Translation language">
          {TRANSLATION_LANGUAGES.map((l) => <button key={l.code} type="button" aria-pressed={lang === l.code} onClick={() => setLang(l.code)}>{l.label} <span lang={l.code}>{l.native}</span></button>)}
        </div>
        <TextField label={`Name in ${current.label}`} lang={lang} value={value[lang].name} onChange={(e) => update('name', e.target.value)} error={errors[`translations.${lang}.name`]} maxLength={100} placeholder={englishName} />
        <TextField label={`Description in ${current.label}`} lang={lang} multiline rows={2} value={value[lang].description} onChange={(e) => update('description', e.target.value)} error={errors[`translations.${lang}.description`]} maxLength={500} hint="Leave blank to show the English text" />
      </div>
    </details>
  );
}

function OptionsEditor({ title, hint, rows, onChange, addLabel, placeholder }) {
  const update = (i, field, value) => onChange(rows.map((row, j) => (j === i ? { ...row, [field]: value } : row)));
  return (
    <fieldset className="options-editor">
      <legend className="field-label">{title}</legend>
      {hint && <p className="field-hint">{hint}</p>}
      {rows.map((row, i) => (
        <div key={row._id || i} className="options-row">
          <input className="input" placeholder={placeholder} value={row.name} maxLength={40} onChange={(e) => update(i, 'name', e.target.value)} aria-label={`${title} name ${i + 1}`} />
          <div className="price-input">
            <span aria-hidden="true">₹</span>
            <input className="input" type="number" min="0" step="1" inputMode="decimal" placeholder="0" value={row.price} onChange={(e) => update(i, 'price', e.target.value)} aria-label={`${title} price ${i + 1}`} />
          </div>
          <IconButton label={`Remove ${row.name || 'option'}`} variant="flat" onClick={() => onChange(rows.filter((_, j) => j !== i))}><X size={18} /></IconButton>
        </div>
      ))}
      <Button variant="ghost" size="sm" icon={<Plus size={16} />} onClick={() => onChange([...rows, { name: '', price: '' }])}>{addLabel}</Button>
    </fieldset>
  );
}

// Add or edit one dish. Calls onSaved(item) with the server's copy.
export function ItemEditor({ item, categories, defaultCategory, onClose, onSaved }) {
  const toast = useToast();
  const editing = Boolean(item?._id);
  const [form, setForm] = useState(() => (item ? {
    ...emptyItem(), ...item, calories: item.calories ?? '', price: item.price ?? '',
    variants: (item.variants || []).map((v) => ({ ...v })), addOns: (item.addOns || []).map((a) => ({ ...a })),
    translations: emptyTranslations(item.translations)
  } : emptyItem(defaultCategory)));
  const [newCategory, setNewCategory] = useState('');
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const set = (field, value) => setForm((f) => ({ ...f, [field]: value }));
  const categoryChoice = form.category === NEW_CATEGORY || (form.category && !categories.includes(form.category) && !item) ? NEW_CATEGORY : form.category;

  const save = async () => {
    const category = form.category === NEW_CATEGORY ? newCategory.trim() : form.category;
    const cleanOptions = (rows) => rows.filter((r) => r.name.trim()).map((r) => ({ ...(r._id ? { _id: r._id } : {}), name: r.name.trim(), price: Number(r.price) || 0 }));
    const variants = cleanOptions(form.variants);
    const body = {
      name: form.name.trim(),
      description: form.description.trim(),
      category,
      // With sizes, the base price is the cheapest size (the menu shows "from" that price).
      price: variants.length ? Math.min(...variants.map((v) => v.price)) : Number(form.price),
      image: form.image || '',
      available: form.available,
      isVeg: form.isVeg,
      tags: form.tags,
      spiceLevel: form.spiceLevel,
      calories: form.calories === '' ? null : Number(form.calories),
      variants,
      addOns: cleanOptions(form.addOns),
      translations: Object.fromEntries(Object.entries(form.translations).map(([code, t]) => [code, { name: t.name.trim(), description: t.description.trim() }]))
    };
    const next = {};
    if (!body.name) next.name = 'Give the dish a name';
    if (!variants.length && (form.price === '' || Number.isNaN(body.price))) next.price = 'Enter a price';
    setErrors(next);
    if (Object.keys(next).length) return;

    setSaving(true);
    try {
      const res = editing ? await api.put(`/api/menu/${item._id}`, body) : await api.post('/api/menu', body);
      toast.success(editing ? 'Dish updated' : 'Dish added');
      onSaved(res.data);
    } catch (err) {
      const details = err.response?.data?.details;
      if (details) setErrors(Object.fromEntries(details.map((d) => [d.field.split('.')[0], d.message])));
      toast.error(errorMessage(err, 'Could not save the dish'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      wide
      onClose={onClose}
      title={editing ? `Edit ${item.name}` : 'Add a dish'}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save} loading={saving}>{editing ? 'Save changes' : 'Add dish'}</Button></>}
    >
      <div className="editor-grid">
        <div className="stack">
          <TextField label="Name" value={form.name} onChange={(e) => set('name', e.target.value)} error={errors.name} maxLength={100} autoFocus />
          <TextField label="Description" multiline rows={3} value={form.description} onChange={(e) => set('description', e.target.value)} error={errors.description} maxLength={500} hint="One or two lines: ingredients, how it is made" />
          <TranslationsEditor value={form.translations} onChange={(v) => set('translations', v)} errors={errors} englishName={form.name} />
          <div className="form-grid">
            <label className="field">
              <span className="field-label">Category</span>
              <select className="select" value={categoryChoice} onChange={(e) => set('category', e.target.value)}>
                <option value="">No category</option>
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                <option value={NEW_CATEGORY}>+ New category…</option>
              </select>
            </label>
            {categoryChoice === NEW_CATEGORY && (
              <TextField label="New category name" value={newCategory} onChange={(e) => setNewCategory(e.target.value)} maxLength={50} />
            )}
            {form.variants.length === 0 && (
              <TextField label="Price (₹)" type="number" min="0" inputMode="decimal" value={form.price} onChange={(e) => set('price', e.target.value)} error={errors.price} />
            )}
            <TextField label="Calories" type="number" min="0" inputMode="numeric" value={form.calories} onChange={(e) => set('calories', e.target.value)} hint="Optional" />
          </div>

          <div className="row wrap" style={{ gap: 'var(--space-6)' }}>
            <div className="segmented" role="group" aria-label="Veg or non-veg">
              <button type="button" aria-pressed={form.isVeg} onClick={() => set('isVeg', true)}>Veg</button>
              <button type="button" aria-pressed={!form.isVeg} onClick={() => set('isVeg', false)}>Non-veg</button>
            </div>
            <Switch checked={form.available} onChange={(v) => set('available', v)} label={form.available ? 'Available' : 'Sold out'} />
          </div>

          <div>
            <p className="field-label" style={{ marginBottom: 6 }}>Badges</p>
            <div className="chip-row wrap">
              {TAGS.map((t) => (
                <Chip key={t.value} active={form.tags.includes(t.value)} onClick={() => set('tags', form.tags.includes(t.value) ? form.tags.filter((x) => x !== t.value) : [...form.tags, t.value])}>{t.label}</Chip>
              ))}
            </div>
          </div>

          <div>
            <p className="field-label" style={{ marginBottom: 6 }}>Spice level</p>
            <div className="segmented" role="group" aria-label="Spice level">
              {SPICE.map((label, level) => <button key={label} type="button" aria-pressed={form.spiceLevel === level} onClick={() => set('spiceLevel', level)}>{label}</button>)}
            </div>
          </div>

          <OptionsEditor title="Sizes" hint="Optional, e.g. Half / Full. Each size has its own price and customers must pick one." rows={form.variants} onChange={(rows) => set('variants', rows)} addLabel="Add size" placeholder="Half" />
          {errors.variants && <p className="field-error">{errors.variants}</p>}
          <OptionsEditor title="Add-ons" hint="Optional extras added to the price, e.g. Extra cheese." rows={form.addOns} onChange={(rows) => set('addOns', rows)} addLabel="Add add-on" placeholder="Extra cheese" />
          {errors.addOns && <p className="field-error">{errors.addOns}</p>}
        </div>

        <ImagePicker
          kind="menu"
          label="Photo"
          value={form.image}
          onChange={(url) => set('image', url)}
          globalPaste
          emptyHint="or paste an image with Ctrl+V"
          previewContext={{
            title: form.name,
            price: form.variants.length ? Math.min(...form.variants.map((v) => Number(v.price) || 0)) : Number(form.price) || 0
          }}
        />
      </div>
    </Modal>
  );
}
