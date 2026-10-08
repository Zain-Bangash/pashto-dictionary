import { LookupsContext, buildLookupsValue } from '../../context/lookupsValue';

const regions = ['Kohat', 'Hangu', 'Tirah', 'Thal', 'Parachinar'];
const pos = ['noun', 'verb', 'adjective', 'adverb', 'phrase', 'other'];

export const LOOKUP_ROWS = [
  ...regions.map((key, order) => ({ _id: `r${order}`, type: 'region', key, label: key, order, active: true, isSystem: true })),
  ...pos.map((key, order) => ({ _id: `p${order}`, type: 'partOfSpeech', key, label: key, order, active: true, isSystem: true })),
];

export function LookupsWrapper({ rows = LOOKUP_ROWS, loading = false, error = null, reload = () => {}, children }) {
  return (
    <LookupsContext.Provider value={buildLookupsValue({ rows, loading, error, reload })}>
      {children}
    </LookupsContext.Provider>
  );
}
