import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { DemoContext } from './demoContext';

function initialDemo(): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('demo') === '1';
}

export function DemoProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabled] = useState(initialDemo);
  const toggle = useCallback(() => setEnabled((value) => !value), []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        event.key.toLowerCase() !== 'd' ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        (target instanceof HTMLElement &&
          (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)))
      )
        return;
      toggle();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [toggle]);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (enabled) url.searchParams.set('demo', '1');
    else url.searchParams.delete('demo');
    window.history.replaceState(
      window.history.state,
      '',
      `${url.pathname}${url.search}${url.hash}`,
    );
  }, [enabled]);

  return <DemoContext value={{ enabled, toggle }}>{children}</DemoContext>;
}
