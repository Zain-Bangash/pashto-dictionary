export const normalizePashto = (text: string): string => text.trim().normalize('NFC');
export const normalizePhonetic = (text: string): string => text.toLowerCase().trim();
