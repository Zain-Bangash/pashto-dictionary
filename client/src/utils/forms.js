// Mirrors server/src/utils/variantForms.ts
export const FORM_KIND_BY_POS = { noun: 'noun', adjective: 'noun', verb: 'verb' };
export const MAX_FORMS = 16;
export const FORM_MAX = { pashto: 100, phonetic: 100, example: 500 };

const GENDERS = ['masculine', 'feminine'];
const NUMBERS = ['singular', 'plural'];
const CASES = ['direct', 'oblique'];
const VERB_FORMS = ['infinitive', 'past', 'present', 'imperative'];

export const SLOTS = {
  noun: GENDERS.flatMap((gender) => NUMBERS.flatMap((number) => CASES.map((c) => ({ kind: 'noun', gender, number, case: c })))),
  verb: VERB_FORMS.map((verbForm) => ({ kind: 'verb', verbForm })),
};

export function formKindFor(partOfSpeech) {
  return FORM_KIND_BY_POS[partOfSpeech] ?? null;
}

export function formSlot(form) {
  return form.kind === 'noun' ? `${form.gender}.${form.number}.${form.case}` : form.verbForm;
}

const SLOT_ORDER = [...SLOTS.noun, ...SLOTS.verb].map(formSlot);
const capitalise = (s) => s.charAt(0).toUpperCase() + s.slice(1);

export function slotLabel(slot) {
  const [gender, number, grammaticalCase] = slot.split('.');
  return number ? `${capitalise(gender)} ${number}, ${grammaticalCase}` : capitalise(gender);
}

export function sortForms(forms = []) {
  return [...forms].sort((a, b) => SLOT_ORDER.indexOf(formSlot(a)) - SLOT_ORDER.indexOf(formSlot(b)));
}

export function slotFields(slot) {
  return [...SLOTS.noun, ...SLOTS.verb].find((s) => formSlot(s) === slot);
}

// Only the keys the server accepts; empty optional text is dropped
export function formsPayload(forms = []) {
  return forms.map((f) => ({
    ...slotFields(formSlot(f)),
    pashto: f.pashto,
    ...(f.phonetic?.trim() && { phonetic: f.phonetic }),
    ...(f.example?.trim() && { example: f.example }),
  }));
}
