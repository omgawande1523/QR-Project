// Dish names and descriptions can be translated to Hindi and Marathi; everything else stays English.
export const MENU_LANGUAGES = [
  { code: 'en', label: 'English', short: 'EN' },
  { code: 'hi', label: 'हिंदी', short: 'हि' },
  { code: 'mr', label: 'मराठी', short: 'म' }
];

// The item as a guest reading `lang` sees it. Missing translations fall back to English, and nameLang /
// descriptionLang say which language each text is in (for the lang attribute).
export function localizeItem(item, lang) {
  const t = lang === 'en' ? null : item.translations?.[lang];
  if (!t?.name && !t?.description) return { ...item, nameLang: 'en', descriptionLang: 'en' };
  return {
    ...item,
    name: t.name || item.name,
    description: t.description || item.description,
    nameEn: item.name,
    descriptionEn: item.description,
    nameLang: t.name ? lang : 'en',
    descriptionLang: t.description ? lang : 'en'
  };
}

// English plus every language at least one dish has a translated name in.
export const availableLanguages = (menu) =>
  MENU_LANGUAGES.filter((l) => l.code === 'en' || menu.some((item) => item.translations?.[l.code]?.name));

// Text a search should match in any language.
export const searchText = (item) => [item.name, item.description, item.nameEn, item.descriptionEn, item.category]
  .filter(Boolean).join(' ').toLowerCase();
