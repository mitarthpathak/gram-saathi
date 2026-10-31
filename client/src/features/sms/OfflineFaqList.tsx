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
      <h2 className="px-1 text-xs font-extrabold tracking-[0.14em] text-ink-soft uppercase">
        {t.faqTitle}
      </h2>
      {items === null && !failed && <Spinner label={t.loading} className="text-ink-soft" />}
      {items === null && failed && <p className="text-base text-ink-soft">{t.faqUnavailable}</p>}
      {items?.map((item) => (
        <details
          key={item.id}
          className="rounded-2xl bg-white p-4 shadow-soft ring-1 ring-ink/5 open:ring-leaf-300"
        >
          <summary className="min-h-8 cursor-pointer text-base font-bold text-ink marker:text-leaf-600">
            {item.question}
          </summary>
          <p className="mt-2 text-base leading-relaxed text-ink-soft">{item.answer}</p>
          {item.sources.length > 0 && (
            <p className="mt-2 text-sm font-semibold text-leaf-600">
              {item.sources.map((source) => `${source.schemeName} · ${source.section}`).join(', ')}
            </p>
          )}
        </details>
      ))}
    </section>
  );
}
