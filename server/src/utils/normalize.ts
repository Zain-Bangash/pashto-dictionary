// Arabic/Urdu/Persian keyboard look-alikes folded to the Pashto letter. ي/ی, ۀ/ه and ښ/ش stay apart: they are distinct letters in Pashto
const LOOKALIKES: Record<string, string> = {
  'ك': 'ک', // ك → ک
  'گ': 'ګ', // گ → ګ
  'ى': 'ی', // ى → ی
  'ہ': 'ه', // ہ → ه
  'ھ': 'ه', // ھ → ه
  'ە': 'ه', // ە → ه
};
const LOOKALIKE_RE = new RegExp(`[${Object.keys(LOOKALIKES).join('')}]`, 'g');

// Optional vowel marks (tanwin, zabar, pesh, zer, shadda, sukun, superscript alef), tatweel, zero-width and bidi controls
const IGNORABLE_RE = /[ً-ْٰـ​-‏‪-‮⁦-⁩﻿]/g;

export const normalizePashto = (text: string): string =>
  text
    .normalize('NFC')
    .replace(LOOKALIKE_RE, (c) => LOOKALIKES[c])
    .replace(IGNORABLE_RE, '')
    .replace(/\s+/g, ' ')
    .trim()
    .normalize('NFC');

export const normalizePhonetic = (text: string): string => text.toLowerCase().trim();
