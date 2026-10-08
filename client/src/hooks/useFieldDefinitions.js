import { useContext } from 'react';
import { FieldsContext } from '../context/fieldsValue';

export default function useFieldDefinitions() {
  return useContext(FieldsContext);
}
