import { useRef } from 'react';
import { BasicPhones } from './BasicPhones';
import { Eligibility } from './Eligibility';
import { FinalCta } from './FinalCta';
import { Fraud } from './Fraud';
import { Languages } from './Languages';
import { ScrollPath } from './ScrollPath';
import { Story } from './Story';

/**
 * Everything below the hero, loaded as its own chunk (GSAP only comes later, with the pinned
 * story on desktop). `paused`: the app covers the page. The footer ships in the same chunk.
 */
export default function Chapters({ paused }: { paused: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div ref={ref} className="relative isolate">
      <ScrollPath container={ref} />
      <Story />
      <Eligibility />
      <Fraud />
      <Languages paused={paused} />
      <BasicPhones />
      <FinalCta />
    </div>
  );
}

export { Footer } from './Footer';
