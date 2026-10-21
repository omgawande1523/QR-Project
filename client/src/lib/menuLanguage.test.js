import { describe, expect, test } from 'vitest';
import { availableLanguages, localizeItem, searchText } from './menuLanguage';

const dosa = { _id: '1', name: 'Masala Dosa', description: 'Crisp crepe', category: 'Breakfast', translations: { hi: { name: 'मसाला डोसा' }, mr: { name: 'मसाला डोसा', description: 'कुरकुरीत डोसा' } } };
const chai = { _id: '2', name: 'Masala Chai', description: 'Strong tea' };

describe('localizeItem', () => {
  test('English leaves the item as it is', () => {
    expect(localizeItem(dosa, 'en')).toMatchObject({ name: 'Masala Dosa', nameLang: 'en' });
  });
  test('uses the translation and falls back per field', () => {
    expect(localizeItem(dosa, 'hi')).toMatchObject({ name: 'मसाला डोसा', nameLang: 'hi', description: 'Crisp crepe', descriptionLang: 'en', nameEn: 'Masala Dosa' });
    expect(localizeItem(dosa, 'mr')).toMatchObject({ description: 'कुरकुरीत डोसा', descriptionLang: 'mr' });
    expect(localizeItem(chai, 'hi')).toMatchObject({ name: 'Masala Chai', nameLang: 'en' });
  });
});

test('only offers languages the menu has', () => {
  expect(availableLanguages([chai]).map((l) => l.code)).toEqual(['en']);
  expect(availableLanguages([chai, dosa]).map((l) => l.code)).toEqual(['en', 'hi', 'mr']);
});

test('search matches the English name while reading Hindi', () => {
  expect(searchText(localizeItem(dosa, 'hi'))).toContain('masala dosa');
  expect(searchText(localizeItem(dosa, 'hi'))).toContain('मसाला डोसा');
});
