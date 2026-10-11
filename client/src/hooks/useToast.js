import { useContext } from 'react';
import { ToastContext } from '../context/toastValue';

export default function useToast() {
  return useContext(ToastContext);
}
