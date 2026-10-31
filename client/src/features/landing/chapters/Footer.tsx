import { Info, ShieldCheck } from 'lucide-react';
import { Village } from '@/components/art/doodles';
import { useStrings } from '@/lib/i18n';
import { chapterStrings } from './strings';

const REPO_URL = 'https://github.com/mitarthpathak/gram-saathi';

/** Oversized wordmark, GitHub link, credits and the "Demo data" disclosure. */
export function Footer() {
  const t = useStrings(chapterStrings);
  return (
    <footer className="relative overflow-hidden bg-paper-alt px-5 pt-20 pb-40 sm:px-8 lg:px-[6vw]">
      <Village className="pointer-events-none absolute right-0 bottom-0 w-[min(60rem,90vw)] opacity-50" />
      <div className="relative mx-auto max-w-[92rem]">
        <p
          aria-hidden
          className="font-display text-[clamp(3.4rem,13vw,12.5rem)] leading-[0.95] font-extrabold tracking-display text-ink"
        >
          Gram Saathi
        </p>
        <p
          aria-hidden
          lang="hi"
          className="font-display text-[clamp(2.8rem,10.5vw,10rem)] leading-[1.3] font-extrabold text-accent"
        >
          ग्राम साथी
        </p>
        <p className="sr-only">Gram Saathi, ग्राम साथी</p>

        <div className="mt-12 grid gap-10 border-t border-ink/10 pt-10 md:grid-cols-[1fr_1.4fr]">
          <div className="flex flex-col items-start gap-4">
            <p className="text-lg font-semibold">{t.footerTagline}</p>
            <a
              href={REPO_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-12 items-center gap-2.5 rounded-full bg-ink px-5 font-bold text-paper transition hover:-translate-y-0.5 active:scale-[0.96]"
            >
              <GitHubMark />
              {t.github}
            </a>
            <p className="text-sm text-ink-soft">{t.credits}</p>
          </div>
          <div className="flex flex-col gap-4">
            <div className="rounded-[1.5rem] bg-white/70 p-5 ring-1 ring-ink/10">
              <p className="flex items-center gap-2 font-bold">
                <Info aria-hidden className="size-5 text-accent-strong" />
                {t.demoTitle}
              </p>
              <p className="mt-2 leading-relaxed text-ink-soft">{t.disclaimer}</p>
            </div>
            <p className="flex items-center gap-2 font-semibold text-leaf-600">
              <ShieldCheck aria-hidden className="size-5" />
              {t.fraudTitle}
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}

/** GitHub's mark (lucide has no brand icons). Decorative: the link has text. */
function GitHubMark() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="size-5" fill="currentColor">
      <path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.87-1.37-3.87-1.37-.53-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.15.08 1.76 1.19 1.76 1.19 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.73-1.54-2.56-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.19-3.09-.12-.29-.52-1.47.11-3.06 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.77.11 3.06.74.8 1.19 1.83 1.19 3.09 0 4.42-2.69 5.39-5.25 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5Z" />
    </svg>
  );
}
