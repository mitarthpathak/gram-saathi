import { cn } from '@/lib/cn';

// Hand-drawn SVG doodles. All decorative (aria-hidden); colours come from the Leaf & Marigold
// palette. Strokes use vector-effect so they keep their weight at any size.

interface DoodleProps {
  className?: string;
}

const GOLD = '#f59312';
const GOLD_FILL = '#ffefd2';

/** Line-art sun; its rays turn slowly in the lively tiers. */
export function Sun({ className }: DoodleProps) {
  const rays = Array.from({ length: 12 }, (_, index) => index * 30);
  return (
    <svg aria-hidden viewBox="0 0 100 100" className={cn('overflow-visible', className)}>
      <g
        className="lively:animate-[spin_40s_linear_infinite]"
        style={{ transformOrigin: '50px 50px', transformBox: 'view-box' }}
      >
        {rays.map((angle, index) => (
          <line
            key={angle}
            x1="50"
            y1={index % 2 ? 22 : 19}
            x2="50"
            y2={index % 2 ? 14 : 8}
            stroke={GOLD}
            strokeWidth="3"
            strokeLinecap="round"
            transform={`rotate(${angle} 50 50)`}
          />
        ))}
      </g>
      <circle cx="50" cy="50" r="19" fill="none" stroke={GOLD} strokeWidth="3.2" />
      <path d="M40 46q4-6 11-6" fill="none" stroke={GOLD} strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

/** One wheat stalk: stem, a long leaf and alternating grains with awns. */
function Stalk({ x, height, lean }: { x: number; height: number; lean: number }) {
  const top = 320 - height;
  const grains = Array.from({ length: 7 }, (_, index) => top + 22 + index * 15);
  return (
    <g transform={`rotate(${lean} ${x} 320)`}>
      <path
        d={`M${x} 320C${x - 2} 250 ${x - 4} ${top + 120} ${x} ${top + 18}`}
        fill="none"
        stroke={GOLD}
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <path
        d={`M${x - 1} 300C${x - 22} 250 ${x - 44} 232 ${x - 66} 226C${x - 46} 240 ${x - 28} 262 ${x - 6} 296`}
        fill={GOLD_FILL}
        stroke={GOLD}
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      {grains.map((y, index) => (
        <g key={y} stroke={GOLD} strokeWidth="2" strokeLinecap="round">
          <ellipse
            cx={x - 8}
            cy={y}
            rx="5.5"
            ry="10"
            transform={`rotate(-32 ${x - 8} ${y})`}
            fill={GOLD_FILL}
          />
          <ellipse
            cx={x + 8}
            cy={y + 7}
            rx="5.5"
            ry="10"
            transform={`rotate(32 ${x + 8} ${y + 7})`}
            fill={GOLD_FILL}
          />
          {index < 5 && (
            <>
              <path d={`M${x - 13} ${y - 8}l-9-13`} fill="none" />
              <path d={`M${x + 13} ${y - 1}l9-13`} fill="none" />
            </>
          )}
        </g>
      ))}
      <ellipse cx={x} cy={top + 10} rx="5" ry="10" fill={GOLD_FILL} stroke={GOLD} strokeWidth="2" />
      <path d={`M${x} ${top}v-16`} stroke={GOLD} strokeWidth="2" strokeLinecap="round" />
    </g>
  );
}

/** Two wheat stalks, swaying gently in the lively tiers. */
export function Wheat({ className }: DoodleProps) {
  return (
    <svg aria-hidden viewBox="0 0 170 330" className={cn('overflow-visible', className)}>
      <g
        className="lively:animate-[sway_7s_var(--ease-in-out-soft)_infinite]"
        style={{ transformOrigin: '100px 320px', transformBox: 'view-box' }}
      >
        <Stalk x={104} height={300} lean={6} />
      </g>
      <g
        className="lively:animate-[sway_8s_var(--ease-in-out-soft)_infinite_-2s]"
        style={{ transformOrigin: '70px 320px', transformBox: 'view-box' }}
      >
        <Stalk x={72} height={230} lean={-12} />
      </g>
    </svg>
  );
}

/** A faint village on the horizon: houses, a hut, trees and a water tank. */
export function Village({ className }: DoodleProps) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 800 150"
      preserveAspectRatio="xMaxYMax meet"
      className={cn('overflow-visible', className)}
    >
      <g fill="#f3d4ae">
        <path d="M0 150v-14c120-8 260-10 400-8s280 4 400-2v24Z" />
        {/* Trees */}
        <circle cx="70" cy="104" r="20" />
        <rect x="67" y="110" width="6" height="30" rx="2" />
        <circle cx="610" cy="88" r="26" />
        <circle cx="636" cy="100" r="18" />
        <rect x="610" y="96" width="7" height="44" rx="2" />
        <circle cx="770" cy="98" r="22" />
        <rect x="767" y="106" width="6" height="34" rx="2" />
        {/* Houses */}
        <path d="M120 140v-36l30-24 30 24v36Z" />
        <path d="M186 140v-28h52v28Z" />
        <path d="M180 114l32-22 32 22Z" />
        <path d="M300 140v-44l40-30 40 30v44Z" />
        <path d="M388 140v-26h70v26Z" />
        <path d="M382 116l41-24 41 24Z" />
        {/* Hut */}
        <path d="M486 140v-22q30-34 60 0v22Z" />
        {/* Water tank */}
        <rect x="548" y="52" width="34" height="26" rx="5" />
        <path d="M553 78l-6 62M577 78l6 62M550 108h30" stroke="#f3d4ae" strokeWidth="4" />
        <path d="M660 140v-34l28-22 28 22v34Z" />
      </g>
      <g fill="#ecc497">
        <rect x="142" y="114" width="16" height="26" rx="2" />
        <rect x="330" y="108" width="20" height="32" rx="2" />
        <rect x="407" y="122" width="14" height="10" rx="2" />
        <rect x="680" y="114" width="16" height="26" rx="2" />
      </g>
    </svg>
  );
}

/** A pair of birds in flight. */
export function Birds({ className }: DoodleProps) {
  return (
    <svg aria-hidden viewBox="0 0 60 30" className={cn('overflow-visible', className)}>
      <g fill="none" stroke="#a59d91" strokeWidth="2.2" strokeLinecap="round">
        <path d="M2 14q6-8 12 0q6-8 12 0" />
        <path d="M34 6q4-5 8 0q4-5 8 0" />
      </g>
    </svg>
  );
}

/** Four-point twinkle. */
export function Sparkle({ className }: DoodleProps) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={cn('overflow-visible', className)}>
      <path
        d="M12 1.5c.8 5.5 3.2 8.4 10.5 10.5-7.3 2.1-9.7 5-10.5 10.5C11.2 17 8.8 14.1 1.5 12 8.8 9.9 11.2 7 12 1.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

/** Hand-drawn marigold squiggle for underlining a word. Stretches to its box. */
export function WavyUnderline({ className }: DoodleProps) {
  return (
    <svg aria-hidden viewBox="0 0 300 26" preserveAspectRatio="none" className={className}>
      <path
        d="M4 16C38 8 66 19 106 12s74-6 112 1 52 3 78-2"
        fill="none"
        stroke="#ffa826"
        strokeWidth="5"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M14 23c22-4 40-4 60-6"
        fill="none"
        stroke="#ffa826"
        strokeWidth="3"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
        opacity="0.7"
      />
    </svg>
  );
}
