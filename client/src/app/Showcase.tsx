import { ArrowRight, Mic, ShieldAlert, ShieldCheck } from 'lucide-react';
import { Logo } from '@/components/brand/Logo';
import { LANGUAGES } from '@/features/language/languages';
import { cn } from '@/lib/cn';
import { config } from '@/lib/config';

/** Desktop companion panel: explain the service without competing with the working phone demo. */
export function Showcase({ className }: { className?: string }) {
  return (
    <section
      aria-label={`About ${config.appName}`}
      className={cn(
        'relative z-10 max-h-full max-w-xl flex-col justify-center gap-6 overflow-y-auto text-brand-950 xl:gap-8',
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <Logo className="size-12 rounded-2xl ring-2 ring-brand-200" />
        <div>
          <p className="text-2xl font-extrabold tracking-tight">{config.appName}</p>
          <p className="text-base font-semibold text-brand-700">ग्राम साथी · Your village helper</p>
        </div>
      </div>

      <div>
        <h1 className="max-w-lg text-[2.4rem] leading-[1.05] font-extrabold tracking-tight text-balance xl:text-[2.8rem]">
          Ask in your own boli.
          <span className="mt-1 block text-brand-700">Get a clear, trusted answer.</span>
        </h1>
        <p className="mt-4 max-w-lg text-lg leading-relaxed text-slate-700">
          Speak naturally. We check official scheme documents, then answer in your language with a
          source and a safety reminder.
        </p>
      </div>

      <ul aria-label="Languages" className="flex flex-wrap gap-2">
        {LANGUAGES.map((language) => (
          <li
            key={language.code}
            lang={language.code}
            className="rounded-full bg-white px-4 py-2 text-base font-bold text-brand-900 shadow-sm ring-1 ring-brand-200"
          >
            {language.nativeName}
          </li>
        ))}
      </ul>

      <div className="rounded-3xl bg-brand-950 p-5 text-white shadow-soft">
        <p className="text-base font-extrabold text-marigold-300">A simple promise</p>
        <p className="mt-1 text-xl leading-snug font-bold">A useful answer, with a source you can check.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <p className="flex items-start gap-2 text-base leading-snug text-brand-50">
            <ShieldCheck aria-hidden className="mt-0.5 size-5 shrink-0 text-marigold-300" />
            Only official scheme information is used.
          </p>
          <p className="flex items-start gap-2 text-base leading-snug text-brand-50">
            <ShieldAlert aria-hidden className="mt-0.5 size-5 shrink-0 text-marigold-300" />
            Every answer carries a reminder about fraud.
          </p>
        </div>
      </div>

      <p className="flex items-center gap-2 text-base font-semibold text-brand-800">
        <Mic aria-hidden className="size-5" />
        Hold the mic, or tap a question to begin.
        <ArrowRight aria-hidden className="size-4" />
      </p>
    </section>
  );
}
