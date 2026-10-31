import { useEffect, useId, useRef } from 'react';
import { cn } from '@/lib/cn';

export type MascotMood = 'idle' | 'wave' | 'listening' | 'thinking' | 'happy';

interface MascotProps {
  mood?: MascotMood;
  /** Pupils follow the mouse (Full motion tier only; costs one listener). */
  followCursor?: boolean;
  className?: string;
}

const INK = '#26231f';
const LEAF = '#1e8a5a';
const LEAF_LIGHT = '#4cb47f';
const CHEEK = '#ffa826';

/**
 * Saathi: a seed with a sprout. Pure inline SVG with five moods; the blink, wave and bob are CSS
 * animations, so the Reduced tier simply stops them. Decorative: give it a label where it matters.
 */
export function Mascot({ mood = 'idle', followCursor = false, className }: MascotProps) {
  const id = useId();
  const svgRef = useRef<SVGSVGElement>(null);
  const eyesRef = useRef<SVGGElement>(null);
  const armUp = mood === 'wave' || mood === 'happy';

  // Gaze: nudge the pupils (max 2.6 units) towards the pointer, once per frame.
  useEffect(() => {
    if (!followCursor) return;
    let frame = 0;
    const onMove = (event: PointerEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const svg = svgRef.current;
        const eyes = eyesRef.current;
        if (!svg || !eyes) return;
        const box = svg.getBoundingClientRect();
        const dx = event.clientX - (box.left + box.width / 2);
        const dy = event.clientY - (box.top + box.height * 0.5);
        const distance = Math.hypot(dx, dy) || 1;
        const reach = Math.min(1, distance / 400) * 2.6;
        eyes.style.transform = `translate(${(dx / distance) * reach}px, ${(dy / distance) * reach}px)`;
      });
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', onMove);
    };
  }, [followCursor]);

  return (
    <svg
      ref={svgRef}
      aria-hidden
      viewBox="0 0 120 150"
      className={cn('overflow-visible', className)}
      data-mood={mood}
    >
      <defs>
        <linearGradient id={`${id}-body`} x1="0.25" y1="0" x2="0.75" y2="1">
          <stop offset="0" stopColor="#eaf7ee" />
          <stop offset="1" stopColor="#a6d8b9" />
        </linearGradient>
      </defs>

      {/* Legs, dangling (Saathi likes to sit on things). */}
      <g stroke={INK} strokeWidth="3" strokeLinecap="round" fill="none">
        <path d="M50 120c-1 8-3 14-5 19" />
        <path d="M70 120c1 8 3 14 5 19" />
      </g>
      <ellipse cx="43" cy="141" rx="6.5" ry="3.6" fill={INK} />
      <ellipse cx="77" cy="141" rx="6.5" ry="3.6" fill={INK} />

      {/* Left arm. */}
      <g
        className={cn(mood === 'happy' && 'lively:animate-wave')}
        style={{ transformOrigin: '26px 88px', transformBox: 'view-box' }}
      >
        {mood === 'happy' ? (
          <path
            d="M26 86c-8-6-12-15-12-25"
            stroke={INK}
            strokeWidth="3"
            strokeLinecap="round"
            fill="none"
          />
        ) : (
          <path
            d="M26 88c-8 6-11 13-10 20"
            stroke={INK}
            strokeWidth="3"
            strokeLinecap="round"
            fill="none"
          />
        )}
        <circle
          cx={mood === 'happy' ? 14 : 16}
          cy={mood === 'happy' ? 58 : 109}
          r="4.5"
          fill="#cfeedd"
          stroke={INK}
          strokeWidth="2.5"
        />
      </g>

      {/* Right arm: waves hello. */}
      <g
        className={cn(armUp && 'lively:animate-wave')}
        style={{ transformOrigin: '94px 86px', transformBox: 'view-box' }}
      >
        {armUp ? (
          <path
            d="M94 86c8-7 12-17 12-28"
            stroke={INK}
            strokeWidth="3"
            strokeLinecap="round"
            fill="none"
          />
        ) : (
          <path
            d="M94 88c8 6 11 13 10 20"
            stroke={INK}
            strokeWidth="3"
            strokeLinecap="round"
            fill="none"
          />
        )}
        <circle
          cx={armUp ? 106 : 104}
          cy={armUp ? 55 : 109}
          r="4.5"
          fill="#cfeedd"
          stroke={INK}
          strokeWidth="2.5"
        />
      </g>

      {/* Sprout. */}
      <g
        className={cn(mood === 'listening' ? 'lively:animate-twinkle' : 'lively:animate-bob')}
        style={{ transformOrigin: '60px 32px', transformBox: 'view-box' }}
      >
        <path
          d="M60 33c0-7 1-13 2-19"
          stroke={LEAF}
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M61 18C52 8 40 9 35 14c6 7 18 8 26 4Z"
          fill={LEAF_LIGHT}
          stroke={INK}
          strokeWidth="2.2"
          strokeLinejoin="round"
        />
        <path
          d="M62 15c8-11 22-12 27-6-6 8-19 11-27 6Z"
          fill={LEAF}
          stroke={INK}
          strokeWidth="2.2"
          strokeLinejoin="round"
        />
        <path
          d="M44 14c5 1 10 2 15 3M68 12c5-2 10-3 15-3"
          stroke="#eaf7ee"
          strokeWidth="1.4"
          strokeLinecap="round"
          opacity="0.7"
        />
      </g>

      {/* Body: a seed. */}
      <path
        d="M60 30c26 0 39 28 37 56-2 26-17 38-37 38s-35-12-37-38c-2-28 11-56 37-56Z"
        fill={`url(#${id}-body)`}
        stroke={INK}
        strokeWidth="3"
      />
      <ellipse
        cx="44"
        cy="52"
        rx="7"
        ry="12"
        fill="#fff"
        opacity="0.6"
        transform="rotate(-24 44 52)"
      />

      {/* Cheeks. */}
      <ellipse
        cx="37"
        cy="91"
        rx="7"
        ry="4.4"
        fill={CHEEK}
        opacity={mood === 'happy' ? 0.75 : 0.5}
      />
      <ellipse
        cx="83"
        cy="91"
        rx="7"
        ry="4.4"
        fill={CHEEK}
        opacity={mood === 'happy' ? 0.75 : 0.5}
      />

      {/* Eyes. */}
      <g ref={eyesRef} className="transition-transform duration-200 ease-out">
        {mood === 'happy' ? (
          <g stroke={INK} strokeWidth="3.2" strokeLinecap="round" fill="none">
            <path d="M41 79q6-8 12 0" />
            <path d="M67 79q6-8 12 0" />
          </g>
        ) : (
          <g
            className="lively:animate-blink"
            style={{ transformOrigin: '60px 77px', transformBox: 'view-box' }}
          >
            <ellipse cx="47" cy="77" rx="5.4" ry={mood === 'listening' ? 7.4 : 6.6} fill={INK} />
            <ellipse cx="73" cy="77" rx="5.4" ry={mood === 'listening' ? 7.4 : 6.6} fill={INK} />
            <circle
              cx={mood === 'thinking' ? 46 : 49}
              cy={mood === 'thinking' ? 72 : 74}
              r="2"
              fill="#fff"
            />
            <circle
              cx={mood === 'thinking' ? 72 : 75}
              cy={mood === 'thinking' ? 72 : 74}
              r="2"
              fill="#fff"
            />
          </g>
        )}
      </g>

      {/* Mouth. */}
      {mood === 'happy' && (
        <g>
          <path
            d="M51 92q9 14 18 0Z"
            fill={INK}
            stroke={INK}
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <ellipse cx="60" cy="99" rx="4" ry="2.4" fill="#ff8a7a" />
        </g>
      )}
      {mood === 'listening' && <ellipse cx="60" cy="95" rx="3.6" ry="4.2" fill={INK} />}
      {mood === 'thinking' && (
        <path
          d="M53 96q3.5-3 7 0t7 0"
          stroke={INK}
          strokeWidth="2.8"
          strokeLinecap="round"
          fill="none"
        />
      )}
      {(mood === 'idle' || mood === 'wave') && (
        <path d="M53 92q7 7 14 0" stroke={INK} strokeWidth="3" strokeLinecap="round" fill="none" />
      )}

      {/* Mood extras. */}
      {mood === 'listening' && (
        <g
          stroke={LEAF_LIGHT}
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
          className="lively:animate-twinkle"
        >
          <path d="M106 64q6 8 0 16" />
          <path d="M113 58q10 14 0 28" />
        </g>
      )}
      {mood === 'thinking' && (
        <g fill="#fff" stroke={INK} strokeWidth="2">
          <circle cx="98" cy="30" r="3" />
          <circle cx="106" cy="20" r="4.2" />
          <circle cx="116" cy="7" r="5.6" className="lively:animate-twinkle" />
        </g>
      )}
      {mood === 'happy' && (
        <g fill={CHEEK} className="lively:animate-twinkle">
          <path d="M14 30l2 5 5 2-5 2-2 5-2-5-5-2 5-2Z" />
          <path d="M104 26l1.6 4 4 1.6-4 1.6-1.6 4-1.6-4-4-1.6 4-1.6Z" />
        </g>
      )}
    </svg>
  );
}
