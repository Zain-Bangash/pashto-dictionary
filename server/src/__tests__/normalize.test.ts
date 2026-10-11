const { normalizePashto } = require('../utils/normalize');

describe('normalizePashto', () => {
  test('trims and collapses inner whitespace', () => {
    expect(normalizePashto('  د   کور  ')).toBe('د کور');
  });

  test('folds Arabic kaf, Persian gaf and alef maksura to the Pashto letters', () => {
    expect(normalizePashto('كور')).toBe('کور');
    expect(normalizePashto('گل')).toBe('ګل');
    expect(normalizePashto('ى')).toBe('ی');
  });

  test('folds Urdu heh forms to ه', () => {
    expect(normalizePashto('کوٹہ')).toBe('کوٹه');
    expect(normalizePashto('ھغه')).toBe('هغه');
  });

  test('drops optional vowel marks, tatweel and zero-width characters', () => {
    expect(normalizePashto('کَور')).toBe('کور');
    expect(normalizePashto('کـور')).toBe('کور');
    expect(normalizePashto('ک‌ور‏')).toBe('کور');
  });

  test('keeps letters that are distinct in Pashto', () => {
    expect(normalizePashto('سړی')).not.toBe(normalizePashto('سړي'));
    expect(normalizePashto('ښه')).not.toBe(normalizePashto('شه'));
    expect(normalizePashto('ۍ')).toBe('ۍ');
    expect(normalizePashto('ې')).toBe('ې');
  });

  test('a string of only vowel marks normalizes to empty', () => {
    expect(normalizePashto('َ ِ')).toBe('');
  });
});
