import {
  ArrowRight,
  ClipboardCheck,
  FileSearch,
  MessageSquareText,
  Mic,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
} from 'lucide-react';
import { Logo } from '@/components/brand/Logo';
import { LANGUAGES } from '@/features/language/languages';
import { cn } from '@/lib/cn';
import { config } from '@/lib/config';

const FEATURES = [
  {
    Icon: ShieldCheck,
    title: 'Only official answers',
    text: 'Answers come from scheme documents and cite their source. Not covered? It says so.',
  },
  {
    Icon: Smartphone,
    title: 'Works on any phone',
    text: 'Every answer also fits in 2 SMS, and low-data mode keeps answers offline.',
  },
  {
    Icon: ClipboardCheck,
    title: 'Eligibility in a minute',
    text: 'A few answers, checked against clear rules: same answers, same result.',
  },
  {
    Icon: ShieldAlert,
    title: 'Fraud shield',
    text: 'Every answer reminds people: no scheme ever asks for money or an OTP.',
  },
];

const STEPS = [
  { Icon: Mic, label: 'You ask by voice' },
  { Icon: FileSearch, label: 'Official documents are searched' },
  { Icon: MessageSquareText, label: 'Short answer, read aloud + SMS' },
];

/** Desktop-only pitch panel next to the phone: what the app does, for judges and visitors. */
export function Showcase({ className }: { className?: string }) {
  return (
    <section
      aria-label={`About ${config.appName}`}
      className={cn(
        'relative z-10 max-h-full max-w-xl flex-col gap-5 overflow-y-auto text-white xl:gap-6',
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <Logo className="size-12 rounded-2xl ring-2 ring-white/20" />
        <div>
          <p className="text-2xl font-extrabold tracking-tight">{config.appName}</p>
          <p className="text-sm font-semibold text-brand-200">ग्राम साथी · Your village helper</p>
        </div>
      </div>

      <h1 className="text-[2.75rem] leading-[1.05] font-extrabold tracking-tight text-balance xl:text-5xl">
        Government schemes, explained{' '}
        <span className="bg-linear-to-r from-marigold-200 to-marigold-400 bg-clip-text text-transparent">
          in your own language.
        </span>
      </h1>

      <p className="max-w-lg text-lg leading-relaxed text-brand-100/90 [@media(max-height:700px)]:hidden">
        A voice assistant for rural India: speak a question, get a short answer taken only from
        official scheme documents, with its source, an SMS copy and a fraud warning.
      </p>

      <ul aria-label="Languages" className="flex flex-wrap gap-2">
        {LANGUAGES.map((language) => (
          <li
            key={language.code}
            lang={language.code}
            className="rounded-full bg-white/10 px-4 py-1.5 text-base font-bold ring-1 ring-white/15"
          >
            {language.nativeName}
          </li>
        ))}
      </ul>

      <ol className="flex items-center gap-2 text-sm font-semibold text-brand-50">
        {STEPS.map(({ Icon, label }, index) => (
          <li key={label} className="flex items-center gap-2">
            {index > 0 && <ArrowRight aria-hidden className="size-4 shrink-0 text-marigold-300" />}
            <span className="flex items-center gap-2 rounded-2xl bg-white/[0.07] px-3 py-2 ring-1 ring-white/10">
              <Icon aria-hidden className="size-4 shrink-0 text-marigold-300" />
              {label}
            </span>
          </li>
        ))}
      </ol>

      <ul className="grid grid-cols-2 gap-3">
        {FEATURES.map(({ Icon, title, text }) => (
          <li
            key={title}
            className="rounded-2xl bg-white/[0.06] p-4 ring-1 ring-white/10 backdrop-blur-sm"
          >
            <span className="flex size-9 items-center justify-center rounded-xl bg-marigold-400/15">
              <Icon aria-hidden className="size-5 text-marigold-300" />
            </span>
            <p className="mt-2.5 font-bold">{title}</p>
            <p className="mt-1 text-sm leading-snug text-brand-100/80 [@media(max-height:820px)]:hidden">
              {text}
            </p>
          </li>
        ))}
      </ul>

      <p className="flex items-center gap-2 text-sm font-semibold text-brand-200">
        Try it on the phone: hold the mic, or tap a scheme
        <ArrowRight aria-hidden className="size-4" />
      </p>
    </section>
  );
}
