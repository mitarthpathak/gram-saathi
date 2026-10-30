import type { FaqItem, LanguageCode } from '@gram-saathi/shared';
import { useEffect, useState } from 'react';
import { Spinner } from '@/components/ui/Spinner';
import { api } from '@/lib/api';
import { useStrings } from '@/lib/i18n';
import { useSettings } from '@/lib/settings';
import { storage } from '@/lib/storage';
import { smsStrings } from './strings';

const cacheKey = (language: LanguageCode) => `gs:faq:${language}`;

/**
 * Top questions, saved on the device so they work with no signal. Downloaded only in
 * low-bandwidth mode. Render with `key={language}` so a language switch reloads the list.
 *
 * TODO(step-3): precache /api/faq/top in the service worker so it works on first offline launch.
 */
export function OfflineFaqList() {
  const t = useStrings(smsStrings);
  const { language, lowBandwidth } = useSettings();
  const [items, setItems] = useState(() => storage.getJson<FaqItem[]>(cacheKey(language)));
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!lowBandwidth) return;
    let cancelled = false;
    api
      .faqTop(language)
      .then((response) => {
        if (cancelled) return;
        storage.setJson(cacheKey(language), response.items);
        setItems(response.items);
      })
      .catch(() => {
        if (!cancelled) setFailed(true); // offline: keep showing the saved copy, if any
      });
    return () => {
      cancelled = true;
    };
  }, [language, lowBandwidth]);

  if (!lowBandwidth) return null;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xl font-bold">{t.faqTitle}</h2>
      {items === null && !failed && <Spinner label={t.loading} className="text-slate-700" />}
      {items === null && failed && <p className="text-base text-slate-700">{t.faqUnavailable}</p>}
      {items?.map((item) => (
        <details
          key={item.id}
          className="rounded-xl border border-slate-200 bg-white p-3 open:bg-brand-50"
        >
          <summary className="min-h-8 cursor-pointer text-lg font-semibold">
            {item.question}
          </summary>
          <p className="mt-2 text-base">{item.answer}</p>
          {item.sources.length > 0 && (
            <p className="mt-1 text-sm text-slate-600">
              {item.sources.map((source) => `${source.schemeName} · ${source.section}`).join(', ')}
            </p>
          )}
        </details>
      ))}
    </section>
  );
}
