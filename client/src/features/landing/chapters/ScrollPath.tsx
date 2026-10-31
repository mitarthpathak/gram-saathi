import { useEffect, useRef, useState, type RefObject } from 'react';
import { useMotionTier } from '@/lib/motion/tier';

/**
 * A dotted, hand-drawn path that winds down the chapters and draws itself as you scroll
 * (clip-path only). Decorative; lives in the side gutters, behind the content.
 */
export function ScrollPath({ container }: { container: RefObject<HTMLElement | null> }) {
  const tier = useMotionTier();
  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [container]);

  useEffect(() => {
    const svg = svgRef.current;
    const element = container.current;
    if (!svg || !element) return;
    if (tier === 'reduced') {
      svg.style.clipPath = 'none';
      return;
    }
    let frame = 0;
    const update = () => {
      frame = 0;
      const box = element.getBoundingClientRect();
      const progress = (window.innerHeight * 0.75 - box.top) / box.height;
      const hidden = 100 - Math.min(100, Math.max(0, progress * 100));
      svg.style.clipPath = `inset(0 0 ${hidden}% 0)`;
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
    };
  }, [container, tier]);

  const { width, height } = size;
  if (!width || !height) return null;

  // Swings between the two gutters, one bend roughly every screen.
  const bends = Math.max(2, Math.round(height / 900));
  const left = width * 0.035;
  const right = width * 0.965;
  let d = `M${width / 2} 0`;
  for (let i = 1; i <= bends; i += 1) {
    const y = (height * i) / bends;
    const x = i % 2 ? left : right;
    const previous = (height * (i - 1)) / bends;
    d += ` C${i === 1 ? width / 2 : i % 2 ? right : left} ${previous + (y - previous) * 0.45}, ${x} ${y - (y - previous) * 0.55}, ${x} ${y}`;
  }

  return (
    <svg
      ref={svgRef}
      aria-hidden
      width={width}
      height={height}
      className="pointer-events-none absolute inset-0 -z-10 hidden md:block"
    >
      <path
        d={d}
        fill="none"
        stroke="#e3b27a"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeDasharray="0.1 14"
        opacity="0.75"
      />
    </svg>
  );
}
