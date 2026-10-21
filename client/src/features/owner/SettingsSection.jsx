import { Button, Card } from '../../components/ui';

// One card on the Settings page: title, description, fields and an optional Save button.
export function Section({ title, description, children, onSave, saving, dirty = true, className = '' }) {
  return (
    <Card as="section" className={`settings-section ${className}`}>
      <div className="settings-head">
        <h2 className="card-title">{title}</h2>
        {description && <p className="muted text-sm">{description}</p>}
      </div>
      <div className="stack">{children}</div>
      {onSave && (
        <div className="settings-foot">
          <Button onClick={onSave} loading={saving} disabled={!dirty}>Save</Button>
        </div>
      )}
    </Card>
  );
}
