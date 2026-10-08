import { useContext } from 'react';
import { LookupsContext } from '../context/lookupsValue';

export default function useLookups() {
  return useContext(LookupsContext);
}
