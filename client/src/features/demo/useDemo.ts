import { useContext } from 'react';
import { DemoContext } from './demoContext';

export function useDemo() {
  const value = useContext(DemoContext);
  if (!value) throw new Error('useDemo must be used inside <DemoProvider>');
  return value;
}
