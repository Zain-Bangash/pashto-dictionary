import { createContext } from 'react';

// Without a provider (tests, pages outside the dashboard) toasts are silently dropped
export const ToastContext = createContext(() => {});
