import { useCallback, useEffect, useRef, useState } from 'react';
import { ImagePlus, Crop, Trash2, Upload, Link2, Camera, Images } from 'lucide-react';
import { Button, useToast } from './ui';
import { CropModal } from './CropModal';
import { errorMessage } from '../lib/api';
import { IMAGE_FIELDS, MAX_IMAGE_MB, uploadOriginal, importImageUrl, imageSource } from '../lib/images';
import { IS_APP, isNative } from '../lib/platform';

const looksLikeUrl = (text) => /^https?:\/\/\S+$/i.test(text.trim());
const imageFromClipboard = (data) => [...(data?.items || [])].find((item) => item.kind === 'file' && item.type.startsWith('image/'))?.getAsFile() || null;

// One picker for every image field: upload (click or drag and drop), paste (Ctrl+V an image or a link)
// or a pasted image URL. Every image then goes through the crop modal before it is used.
// With `globalPaste`, an image pasted anywhere on the page lands here (use it when the picker is the
// only one on screen, e.g. in the dish editor).
export function ImagePicker({ kind, value, onChange, label = 'Photo', globalPaste = false, previewContext, emptyHint }) {
  const toast = useToast();
  const field = IMAGE_FIELDS[kind];
  const inputRef = useRef(null);
  const [busy, setBusy] = useState('');
  const [dragging, setDragging] = useState(false);
  const [link, setLink] = useState('');
  const [source, setSource] = useState(null);

  const start = useCallback(async (message, load) => {
    setBusy(message);
    try {
      setSource(await load());
    } catch (err) {
      toast.error(errorMessage(err, 'Could not add that image'));
    } finally {
      setBusy('');
    }
  }, [toast]);

  const fromFile = useCallback((file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) return toast.error('That file is not an image');
    if (file.size > MAX_IMAGE_MB * 1024 * 1024) return toast.error(`Image is too large (the limit is ${MAX_IMAGE_MB} MB)`);
    return start('Uploading…', () => uploadOriginal(file));
  }, [start, toast]);

  const fromUrl = useCallback((url) => {
    if (!looksLikeUrl(url)) return toast.error('Paste a link that starts with http:// or https://');
    setLink('');
    return start('Downloading…', () => importImageUrl(url.trim()));
  }, [start, toast]);

  const handlePaste = useCallback((event) => {
    const file = imageFromClipboard(event.clipboardData);
    if (file) {
      event.preventDefault();
      fromFile(file);
      return true;
    }
    return false;
  }, [fromFile]);

  // Page-wide paste of an image (not text: typing fields keep normal paste).
  useEffect(() => {
    if (!globalPaste) return undefined;
    const onPaste = (event) => { if (!source && !busy) handlePaste(event); };
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }, [globalPaste, handlePaste, source, busy]);

  const onZonePaste = (event) => {
    if (handlePaste(event)) return;
    const text = event.clipboardData?.getData('text') || '';
    if (looksLikeUrl(text)) {
      event.preventDefault();
      fromUrl(text);
    }
  };

  const editCrop = () => start('Opening…', () => imageSource(value));

  // App: the phone's camera or gallery, then the same upload and crop as a chosen file.
  const native = isNative();
  const fromPhone = async (source) => {
    if (IS_APP) {
      try {
        const { pickPhoto } = await import('../native/camera');
        const file = await pickPhoto(source);
        if (file) fromFile(file);
      } catch (err) {
        toast.error(/denied|permission/i.test(err?.message || '') ? 'Allow camera and photo access for QR Menu Staff in Android settings' : 'Could not get the photo');
      }
    }
  };

  return (
    <div className="image-picker">
      <span className="field-label">{label}</span>
      <div
        className={`picker-zone ${dragging ? 'is-drag' : ''} ${value ? 'has-image' : ''} ${field.round ? 'is-round' : ''}`}
        style={{ aspectRatio: field.aspect }}
        role="button"
        tabIndex={0}
        aria-label={`${label}: click to upload, drop a file, or paste an image`}
        onClick={() => !busy && inputRef.current?.click()}
        onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !busy) { e.preventDefault(); inputRef.current?.click(); } }}
        onPaste={onZonePaste}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files?.[0];
          if (file) fromFile(file);
          else if (looksLikeUrl(e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text') || '')) fromUrl(e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text'));
        }}
      >
        {value ? <img src={value} alt="" /> : (
          <span className="picker-empty">
            <ImagePlus size={26} aria-hidden="true" />
            <span className="bold text-sm">Drop a photo, click to upload</span>
            <span className="text-xs">{emptyHint || 'or click here and press Ctrl+V'}</span>
          </span>
        )}
        {busy && <span className="picker-busy" role="status"><span className="spinner" /> {busy}</span>}
      </div>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" className="sr-only" tabIndex={-1} aria-hidden="true"
        onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ''; fromFile(file); }} />

      <div className="row wrap picker-actions">
        {native && (
          <>
            <Button size="sm" variant="secondary" icon={<Camera size={16} />} onClick={() => fromPhone('camera')} disabled={Boolean(busy)}>Take photo</Button>
            <Button size="sm" variant="secondary" icon={<Images size={16} />} onClick={() => fromPhone('gallery')} disabled={Boolean(busy)}>Choose from gallery</Button>
          </>
        )}
        <Button size="sm" variant="secondary" icon={<Upload size={16} />} onClick={() => inputRef.current?.click()} disabled={Boolean(busy)}>{value ? 'Replace' : 'Upload'}</Button>
        {value && <Button size="sm" variant="secondary" icon={<Crop size={16} />} onClick={editCrop} disabled={Boolean(busy)}>Edit crop</Button>}
        {value && <Button size="sm" variant="ghost" icon={<Trash2 size={16} />} onClick={() => onChange('')} disabled={Boolean(busy)}>Remove</Button>}
      </div>
      <form className="picker-url" onSubmit={(e) => { e.preventDefault(); fromUrl(link); }}>
        <Link2 size={16} aria-hidden="true" />
        <input className="input" type="url" inputMode="url" placeholder="Paste image URL" value={link} onChange={(e) => setLink(e.target.value)} aria-label={`${label}: image URL`} disabled={Boolean(busy)} />
        <Button size="sm" type="submit" variant="secondary" disabled={!link.trim() || Boolean(busy)}>Add</Button>
      </form>
      <p className="field-hint">Use photos you own or have permission to use.</p>

      {source && (
        <CropModal
          source={source}
          kind={kind}
          previewContext={previewContext}
          onCancel={() => setSource(null)}
          onDone={(url) => { setSource(null); onChange(url); }}
        />
      )}
    </div>
  );
}
