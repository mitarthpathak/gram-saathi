import { createContext } from 'react';

export interface DemoState { enabled: boolean; toggle: () => void; }
export const DemoContext = createContext<DemoState | null>(null);
