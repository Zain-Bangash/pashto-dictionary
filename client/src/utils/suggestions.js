import { formSlot } from './forms';

// Field names a suggestion proposes, matching the server's lock keys: phonetic, example, extra.<key>, forms.<slot>
export function proposedFields(suggestion) {
  const p = suggestion?.proposed ?? {};
  return [
    ...['phonetic', 'example'].filter((k) => p[k]),
    ...Object.keys(p.extra ?? {}).map((k) => `extra.${k}`),
    ...(p.forms ?? []).map((f) => `forms.${formSlot(f)}`),
  ];
}
