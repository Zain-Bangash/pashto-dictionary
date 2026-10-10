import { IVariantForm } from '../types/models';
import { FORM_KIND_BY_POS, SLOTS_BY_KIND, formSlot } from './variantForms';
import { normalizePashto } from './normalize';

export type SlotSource = { pashto: string; example?: string; forms?: IVariantForm[] };
export type AudioSlot = { slot: string; text: string; maxSeconds: number };

export const HEADWORD = 'headword';
export const EXAMPLE = 'example';
export const FORM_PREFIX = 'form:';
export const SLOT_PATTERN = /^(headword|example|form:[a-z.]{1,40})$/;

export const MIN_DURATION_MS = 300;
// Recorders stop a little after the limit; the server allows this much over it
export const DURATION_TOLERANCE_MS = 500;

export function maxSeconds(slot: string, text: string, headword: string): number {
  const chars = Array.from((text || headword).replace(/\s/g, '')).length;
  const cap = slot === EXAMPLE ? 20 : 10;
  return Math.min(cap, Math.ceil(chars / 3) + 2);
}

function textOf(source: SlotSource, slot: string): string {
  if (slot === HEADWORD) return source.pashto;
  if (slot === EXAMPLE) return source.example?.trim() ?? '';
  const form = (source.forms ?? []).find((f) => `${FORM_PREFIX}${formSlot(f)}` === slot);
  return form?.pashto ?? '';
}

// Every slot that can hold a clip: the headword, the example once it has text, and each form slot
// the part of speech allows, whether or not that form has text yet
export function audioSlots(source: SlotSource, partOfSpeech?: string): AudioSlot[] {
  const slots = [HEADWORD];
  if (source.example?.trim()) slots.push(EXAMPLE);
  const kind = partOfSpeech ? FORM_KIND_BY_POS[partOfSpeech] : undefined;
  if (kind) slots.push(...SLOTS_BY_KIND[kind].map((s) => `${FORM_PREFIX}${s}`));
  return slots.map((slot) => {
    const text = textOf(source, slot);
    return { slot, text, maxSeconds: maxSeconds(slot, text, source.pashto) };
  });
}

export function findSlot(source: SlotSource, partOfSpeech: string | undefined, slot: string): AudioSlot | undefined {
  return audioSlots(source, partOfSpeech).find((s) => s.slot === slot);
}

// A clip is stale when its slot no longer exists, or when text it was recorded against has changed.
// A form slot that was empty and is now filled keeps its clip.
export function isStaleSlot(slot: string, before: SlotSource, after: SlotSource, partOfSpeechAfter: string | undefined): boolean {
  const target = findSlot(after, partOfSpeechAfter, slot);
  if (!target) return true;
  const was = textOf(before, slot);
  return Boolean(was) && normalizePashto(was) !== normalizePashto(target.text);
}
