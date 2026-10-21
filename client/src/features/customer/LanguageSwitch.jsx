import { Languages } from 'lucide-react';
import { useCustomer } from './CustomerContext';

// English / हिंदी / मराठी for dish names and descriptions; shown only when the menu has translations.
export function LanguageSwitch() {
  const { language, languages, setLanguage } = useCustomer();
  if (languages.length < 2) return null;
  return (
    <div className="language-switch">
      <Languages size={18} aria-hidden="true" />
      <div className="segmented" role="group" aria-label="Menu language">
        {languages.map((l) => (
          <button key={l.code} type="button" lang={l.code} aria-pressed={language === l.code} onClick={() => setLanguage(l.code)}>
            {l.label}
          </button>
        ))}
      </div>
    </div>
  );
}
