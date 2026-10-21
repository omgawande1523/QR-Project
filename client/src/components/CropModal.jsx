import { useCallback, useEffect, useRef, useState } from 'react';
import Cropper from 'react-easy-crop';
import { RotateCcw, RotateCw, Undo2, ZoomIn } from 'lucide-react';
import { Button, Modal, useToast } from './ui';
import { errorMessage } from '../lib/api';
import { IMAGE_FIELDS, cropImage, drawCropPreview } from '../lib/images';
import { formatPrice } from '../lib/format';

function Preview({ kind, canvasRef, context }) {
  const field = IMAGE_FIELDS[kind];
  const size = field.preview === 'card' ? { width: 240, height: 180 } : { width: 200, height: 200 };
  const canvas = <canvas ref={canvasRef} width={size.width} height={size.height} className="crop-preview-canvas" aria-hidden="true" />;
  if (field.preview === 'card') {
    return (
      <div className="crop-preview-card">
        <div className="crop-preview-media">{canvas}</div>
        <div className="crop-preview-body">
          <strong className="truncate">{context?.title || 'Dish name'}</strong>
          <span className="price">{context?.price ? formatPrice(context.price) : '₹ —'}</span>
          <span className="crop-preview-btn">+ Add</span>
        </div>
      </div>
    );
  }
  if (field.preview === 'logo') return <div className="crop-preview-logo">{canvas}</div>;
  if (field.preview === 'hero') return <div className="crop-preview-hero">{canvas}<span>Welcome screen</span></div>;
  return <div className="crop-preview-qr">{canvas}</div>;
}

// Crop, zoom and rotate an original; the server applies the crop (see lib/images.js) and returns the URL.
export function CropModal({ source, kind, onCancel, onDone, previewContext }) {
  const field = IMAGE_FIELDS[kind];
  const toast = useToast();
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(source.rotation || 0);
  const [pixels, setPixels] = useState(null);
  const [saving, setSaving] = useState(false);
  const [initialPixels, setInitialPixels] = useState(source.crop || undefined);
  const [cropperKey, setCropperKey] = useState(0);
  const canvasRef = useRef(null);
  const imgRef = useRef(null);

  // A plain <img> for the preview canvas (drawing works without CORS; nothing is read back).
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      drawCropPreview(canvasRef.current, img, pixels, rotation);
    };
    img.src = source.url;
  }, [source.url]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const frame = requestAnimationFrame(() => drawCropPreview(canvasRef.current, imgRef.current, pixels, rotation));
    return () => cancelAnimationFrame(frame);
  }, [pixels, rotation]);

  const onCropComplete = useCallback((_area, areaPixels) => setPixels(areaPixels), []);

  const reset = () => {
    setInitialPixels(undefined);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setRotation(0);
    setCropperKey((k) => k + 1); // remount so a restored crop is dropped
  };

  const apply = async () => {
    if (!pixels) return;
    setSaving(true);
    try {
      const url = await cropImage({ originalId: source.originalId, kind, crop: pixels, rotation });
      onDone(url);
    } catch (err) {
      toast.error(errorMessage(err, 'Could not crop the image'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      wide
      onClose={onCancel}
      title={field.title}
      footer={(
        <>
          <Button variant="ghost" icon={<Undo2 size={18} />} onClick={reset}>Reset</Button>
          <span className="grow" />
          <Button variant="secondary" onClick={onCancel}>Cancel</Button>
          <Button onClick={apply} loading={saving} disabled={!pixels}>Use this crop</Button>
        </>
      )}
    >
      <div className="crop-layout">
        <div className="stack">
          <div className="crop-area">
            <Cropper
              key={cropperKey}
              image={source.url}
              crop={crop}
              zoom={zoom}
              rotation={rotation}
              aspect={field.aspect}
              cropShape={field.round ? 'round' : 'rect'}
              showGrid={!field.round}
              minZoom={1}
              maxZoom={4}
              zoomSpeed={0.3}
              initialCroppedAreaPixels={initialPixels}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onRotationChange={setRotation}
              onCropComplete={onCropComplete}
              objectFit="contain"
            />
          </div>
          <label className="crop-control">
            <ZoomIn size={18} aria-hidden="true" />
            <span className="crop-control-label">Zoom</span>
            <input type="range" min="1" max="4" step="0.01" value={zoom} onChange={(e) => setZoom(Number(e.target.value))} aria-label="Zoom" />
          </label>
          <div className="crop-control">
            <IconRotate onClick={() => setRotation((r) => ((r - 90 + 540) % 360) - 180)} label="Rotate left 90°"><RotateCcw size={18} /></IconRotate>
            <span className="crop-control-label">Rotate</span>
            <input type="range" min="-180" max="180" step="1" value={rotation} onChange={(e) => setRotation(Number(e.target.value))} aria-label="Rotation in degrees" />
            <span className="crop-degrees">{rotation}°</span>
            <IconRotate onClick={() => setRotation((r) => ((r + 90 + 540) % 360) - 180)} label="Rotate right 90°"><RotateCw size={18} /></IconRotate>
          </div>
          <p className="muted text-xs">Drag to move. Pinch or scroll to zoom.</p>
        </div>
        <div className="crop-preview">
          <p className="field-label">Preview</p>
          <Preview kind={kind} canvasRef={canvasRef} context={previewContext} />
        </div>
      </div>
    </Modal>
  );
}

function IconRotate({ onClick, label, children }) {
  return (
    <button type="button" className="icon-btn flat" onClick={onClick} aria-label={label} title={label}>{children}</button>
  );
}
