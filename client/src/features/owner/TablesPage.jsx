import { useEffect, useMemo, useState } from 'react';
import { Download, FileDown, Plus, Trash2, ExternalLink, AlertTriangle, ImagePlus } from 'lucide-react';
import { useOwner } from './OwnerContext';
import { PageHeader } from './OwnerLayout';
import { Button, Card, EmptyState, IconButton, Skeleton, useToast } from '../../components/ui';
import { errorMessage } from '../../lib/api';
import { uploadImage } from '../../lib/uploadImage';
import { isActiveOrder } from '../../lib/orderStatus';
import { tableUrl, qrCanvas, tableCardCanvas, downloadCanvas, downloadTablesPdf, isDarkEnough, loadImage } from '../../lib/tableCards';

const PRESETS = ['#485000', '#313700', '#1e2112', '#606b00', '#7a2e12', '#1f3d5c'];

function QrPreview({ restaurantId, table, color, logo }) {
  const [src, setSrc] = useState(null);
  useEffect(() => {
    let cancelled = false;
    qrCanvas(tableUrl(restaurantId, table), { size: 320, color, logo }).then((canvas) => !cancelled && setSrc(canvas.toDataURL()));
    return () => { cancelled = true; };
  }, [restaurantId, table, color, logo]);
  return src ? <img src={src} alt={`QR code for table ${table}`} width="160" height="160" className="qr-img" /> : <Skeleton width={160} height={160} />;
}

export default function TablesPage() {
  const { userId, profile, saveProfile, orders } = useOwner();
  const toast = useToast();
  const [newTable, setNewTable] = useState('');
  const [logoImg, setLogoImg] = useState(null);
  const [busy, setBusy] = useState(null);

  const color = profile?.qrColor && profile.qrColor !== '#000000' ? profile.qrColor : '#485000';
  const logoSrc = profile?.qrLogo || profile?.profilePicture || '';
  const tables = useMemo(() => profile?.tables || [], [profile]);
  const scans = profile?.tableStats || {};

  useEffect(() => { loadImage(logoSrc).then(setLogoImg); }, [logoSrc]);

  if (!profile) return <Skeleton height={400} radius="var(--radius-card)" />;

  const save = (patch, message) => saveProfile(patch, { silent: true }).then(() => message && toast.success(message)).catch((err) => toast.error(errorMessage(err)));

  const addTable = (n) => {
    const num = Number(n);
    if (!Number.isInteger(num) || num < 1 || num > 9999) return toast.error('Enter a table number from 1 to 9999');
    if (tables.includes(num)) return toast.error(`Table ${num} already exists`);
    setNewTable('');
    return save({ tables: [...tables, num] }, `Table ${num} added`);
  };

  const removeTable = (num) => {
    const active = orders.filter((o) => o.tableNumber === num && isActiveOrder(o.status)).length;
    const warning = active ? `Table ${num} has ${active} open order(s). Remove it anyway?` : `Remove table ${num}? Its printed QR code will stop working.`;
    if (window.confirm(warning)) save({ tables: tables.filter((t) => t !== num) }, `Table ${num} removed`);
  };

  const downloadOne = async (table) => {
    setBusy(`png-${table}`);
    try {
      const card = await tableCardCanvas({ restaurantName: profile.restaurantName, restaurantId: userId, table, color, logo: logoImg });
      downloadCanvas(card, `table-${table}-qr.png`);
    } finally {
      setBusy(null);
    }
  };

  const downloadAll = async () => {
    setBusy('pdf');
    try {
      await downloadTablesPdf({ restaurantName: profile.restaurantName, restaurantId: userId, tables, color, logo: logoImg });
    } catch {
      toast.error('Could not create the PDF');
    } finally {
      setBusy(null);
    }
  };

  const onLogo = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const url = await uploadImage(file, 'logo');
      await save({ qrLogo: url }, 'QR logo updated');
    } catch (err) {
      toast.error(errorMessage(err, 'Upload failed'));
    }
  };

  const nextTable = tables.length ? Math.max(...tables) + 1 : 1;

  return (
    <>
      <PageHeader
        title="Tables & QR codes"
        subtitle="Each table has its own QR code; customers who scan it order for that table."
        actions={<Button icon={<FileDown size={18} />} onClick={downloadAll} loading={busy === 'pdf'} disabled={!tables.length}>Download all (A4 PDF)</Button>}
      />

      <div className="tables-layout">
        <Card className="stack">
          <h2 className="card-title">QR style</h2>
          <div>
            <p className="field-label" style={{ marginBottom: 8 }}>Colour</p>
            <div className="row wrap">
              {PRESETS.map((c) => (
                <button key={c} type="button" className={`swatch ${color === c ? 'active' : ''}`} style={{ background: c }} onClick={() => save({ qrColor: c })} aria-label={`Use colour ${c}`} aria-pressed={color === c} />
              ))}
              <label className="swatch swatch-custom" title="Custom colour">
                <input type="color" value={color} onChange={(e) => save({ qrColor: e.target.value })} aria-label="Custom QR colour" />
              </label>
            </div>
            {!isDarkEnough(color) && (
              <p className="field-error" style={{ marginTop: 8 }}><AlertTriangle size={14} style={{ display: 'inline', verticalAlign: '-2px' }} /> This colour is too light; some phones may not scan it.</p>
            )}
          </div>
          <div>
            <p className="field-label" style={{ marginBottom: 8 }}>Centre logo</p>
            <p className="muted text-sm" style={{ marginBottom: 8 }}>
              {profile.qrLogo ? 'Using a custom QR logo.' : logoSrc ? 'Using your restaurant logo.' : 'No logo yet.'}
            </p>
            <div className="row wrap">
              <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer' }}>
                <ImagePlus size={16} aria-hidden="true" /> Upload QR logo
                <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={onLogo} />
              </label>
              {profile.qrLogo && <Button size="sm" variant="ghost" onClick={() => save({ qrLogo: '' }, 'Using the restaurant logo')}>Use restaurant logo</Button>}
            </div>
            {!logoSrc && <p className="field-hint" style={{ marginTop: 6 }}>Add a logo in Settings or upload one here.</p>}
          </div>
          <div className="qr-sample">
            <QrPreview restaurantId={userId} table={tables[0] || 1} color={color} logo={logoImg} />
            <p className="muted text-xs">Codes use high error correction, so the logo does not affect scanning.</p>
          </div>
        </Card>

        <div className="stack" style={{ minWidth: 0 }}>
          <Card className="row wrap">
            <form className="row" style={{ gap: 8 }} onSubmit={(e) => { e.preventDefault(); addTable(newTable); }}>
              <input className="input" style={{ width: 140 }} type="number" min="1" max="9999" inputMode="numeric" placeholder="Table no." value={newTable} onChange={(e) => setNewTable(e.target.value)} aria-label="New table number" />
              <Button type="submit" variant="secondary" disabled={!newTable}>Add</Button>
            </form>
            <Button icon={<Plus size={18} />} onClick={() => addTable(nextTable)}>Add table {nextTable}</Button>
            <span className="muted text-sm">{tables.length} table{tables.length === 1 ? '' : 's'}</span>
          </Card>

          {tables.length === 0 ? (
            <EmptyState title="No tables yet" action={<Button onClick={() => addTable(1)}>Add table 1</Button>}>Add tables to print their QR codes.</EmptyState>
          ) : (
            <div className="table-grid">
              {tables.map((table) => (
                <Card key={table} className="table-card">
                  <div className="row-between">
                    <strong className="table-card-title">Table {table}</strong>
                    <IconButton label={`Remove table ${table}`} variant="flat" onClick={() => removeTable(table)}><Trash2 size={18} /></IconButton>
                  </div>
                  <QrPreview restaurantId={userId} table={table} color={color} logo={logoImg} />
                  <p className="muted text-xs">{scans[table] || 0} scan{scans[table] === 1 ? '' : 's'}</p>
                  <div className="row" style={{ gap: 6 }}>
                    <Button size="sm" variant="secondary" icon={<Download size={16} />} onClick={() => downloadOne(table)} loading={busy === `png-${table}`}>PNG</Button>
                    <IconButton label={`Open table ${table} menu`} variant="flat" onClick={() => window.open(tableUrl(userId, table), '_blank', 'noopener')}><ExternalLink size={18} /></IconButton>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
