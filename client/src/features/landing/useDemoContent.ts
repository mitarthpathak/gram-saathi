import { useEffect, useState } from 'react';
import type * as DemoModule from './demoContent';

type DemoContent = typeof DemoModule;

let loaded: DemoContent | null = null;
let loading: Promise<DemoContent> | null = null;

/** The sample exchanges (src/mocks), fetched once after first paint and shared by every chapter. */
export function useDemoContent(): DemoContent | null {
  const [content, setContent] = useState(loaded);
  useEffect(() => {
    if (content) return;
    let cancelled = false;
    loading ??= import('./demoContent').then((module) => (loaded = module));
    void loading.then((module) => {
      if (!cancelled) setContent(module);
    });
    return () => {
      cancelled = true;
    };
  }, [content]);
  return content;
}
