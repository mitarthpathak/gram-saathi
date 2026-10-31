import type { DialectInfo } from '@gram-saathi/shared';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

let dialectList: Promise<DialectInfo[]> | undefined;

/** GET /api/dialects once per page load; an error is retried on the next use. */
function loadDialects(): Promise<DialectInfo[]> {
  dialectList ??= api.dialects().then(
    (response) => response.items,
    () => {
      dialectList = undefined;
      return [];
    },
  );
  return dialectList;
}

/** Registry info (name, test status) for a dialect id; undefined while unknown. */
export function useDialectInfo(id: string | null | undefined): DialectInfo | undefined {
  const [items, setItems] = useState<DialectInfo[]>();
  useEffect(() => {
    if (!id) return;
    let live = true;
    void loadDialects().then((list) => {
      if (live) setItems(list);
    });
    return () => {
      live = false;
    };
  }, [id]);
  return id ? items?.find((item) => item.id === id) : undefined;
}
