import { cn } from '@/lib/cn';

export type Sky = 'dawn' | 'morning' | 'noon' | 'dusk';

/** One full-screen layer per time of day; scrolling crossfades them (opacity only). */
const LAYERS: Record<Sky, string> = {
  dawn: 'bg-[radial-gradient(75%_62%_at_56%_-12%,#ffe3c2_0%,rgb(255_227_194/0.6)_40%,transparent_74%),radial-gradient(45%_45%_at_-5%_45%,rgb(255_236_206/0.75),transparent_70%)]',
  morning:
    'bg-[radial-gradient(70%_60%_at_50%_-10%,#ddf3e6_0%,rgb(238_249_242/0.7)_45%,transparent_75%),linear-gradient(#f6fbf3,#fffaf1)]',
  noon: 'bg-[radial-gradient(70%_60%_at_60%_-10%,#fff3c4_0%,rgb(255_243_196/0.55)_45%,transparent_75%),linear-gradient(#fffbea,#fff6df)]',
  dusk: 'bg-[radial-gradient(80%_60%_at_50%_110%,#5a4580_0%,transparent_70%),linear-gradient(#2b2545,#2b2545)]',
};

/** Fixed sky behind the landing page, with a subtle paper grain on top. */
export function SkyBackground({ sky }: { sky: Sky }) {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 bg-paper">
      {(Object.keys(LAYERS) as Sky[]).map((key) => (
        <div
          key={key}
          className={cn(
            'absolute inset-0 transition-opacity duration-[900ms] ease-out-soft',
            LAYERS[key],
            sky === key ? 'opacity-100' : 'opacity-0',
          )}
        />
      ))}
      <div className="absolute inset-0 bg-grain opacity-[0.35]" />
    </div>
  );
}
