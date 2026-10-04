import { useId } from 'react';
import { clsx } from './ui';

/*
 * Hand-drawn-feeling landscapes in pure SVG. Every colour is a theme token,
 * so the same scene reads as a soft morning in light mode and a calm dusk in
 * dark mode. Decorative only: hidden from assistive tech.
 */

function Tree({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <rect x={-1.6} y={-6} width={3.2} height={14} rx={1.4} fill="var(--ill-tree)" opacity={0.9} />
      <path d="M0 -44 C 10 -34 15 -18 13 -8 C 11 2 -11 2 -13 -8 C -15 -18 -10 -34 0 -44 Z" fill="var(--ill-tree)" />
    </g>
  );
}

function RoundTree({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <rect x={-1.5} y={-4} width={3} height={12} rx={1.4} fill="var(--ill-tree)" opacity={0.9} />
      <circle cx={0} cy={-14} r={13} fill="var(--ill-hill-4)" />
      <circle cx={-6} cy={-10} r={8} fill="var(--ill-tree)" opacity={0.55} />
    </g>
  );
}

/** Rolling hills over still water — the Home hero. */
export function Landscape({ className }: { className?: string }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg viewBox="0 0 640 300" preserveAspectRatio="xMidYMax slice" aria-hidden="true" className={clsx('block', className)}>
      <defs>
        <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--ill-sky-2)" />
          <stop offset="100%" stopColor="var(--ill-sky-1)" />
        </linearGradient>
        <radialGradient id={`${id}-sun`}>
          <stop offset="0%" stopColor="var(--ill-sun)" stopOpacity={0.9} />
          <stop offset="100%" stopColor="var(--ill-sun)" stopOpacity={0} />
        </radialGradient>
        <linearGradient id={`${id}-water`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--ill-water)" />
          <stop offset="100%" stopColor="var(--ill-sky-1)" />
        </linearGradient>
      </defs>
      <rect width="640" height="300" fill={`url(#${id}-sky)`} />
      <circle cx="470" cy="120" r="90" fill={`url(#${id}-sun)`} />
      <circle cx="470" cy="120" r="26" fill="var(--ill-sun)" />
      <path d="M0 170 C 90 120 170 140 250 112 C 330 86 410 128 480 118 C 550 108 600 92 640 100 L640 300 L0 300Z" fill="var(--ill-hill-1)" />
      <path d="M0 200 C 70 168 150 176 220 160 C 300 142 360 178 450 166 C 530 156 590 138 640 146 L640 300 L0 300Z" fill="var(--ill-hill-2)" />
      <path d="M0 232 C 90 206 180 214 260 204 C 340 194 420 220 520 210 C 580 204 620 196 640 198 L640 300 L0 300Z" fill="var(--ill-hill-3)" />
      <rect y="238" width="640" height="62" fill={`url(#${id}-water)`} />
      <path d="M180 262 h120 M360 274 h90 M80 280 h70 M500 256 h60" stroke="var(--surface)" strokeOpacity={0.5} strokeWidth={2} strokeLinecap="round" />
      <Tree x={70} y={232} s={1.1} />
      <Tree x={96} y={236} s={0.8} />
      <Tree x={540} y={212} s={1.2} />
      <Tree x={570} y={216} s={0.9} />
      <RoundTree x={600} y={222} s={0.9} />
      <path d="M0 250 C 40 236 80 238 120 246 C 150 252 170 266 200 300 L0 300Z" fill="var(--ill-hill-4)" />
      <path d="M420 300 C 450 266 490 240 540 234 C 580 230 610 232 640 236 L640 300Z" fill="var(--ill-hill-4)" />
    </svg>
  );
}

/** A path winding up through the hills — the Goals hero. */
export function PathScene({ className }: { className?: string }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg viewBox="0 0 360 240" preserveAspectRatio="xMidYMax slice" aria-hidden="true" className={clsx('block', className)}>
      <defs>
        <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--ill-sky-2)" />
          <stop offset="100%" stopColor="var(--ill-sky-1)" />
        </linearGradient>
      </defs>
      <rect width="360" height="240" fill={`url(#${id}-sky)`} />
      <circle cx="270" cy="62" r="22" fill="var(--ill-sun)" />
      <path d="M0 130 C 60 96 120 110 180 90 C 240 70 300 96 360 84 L360 240 L0 240Z" fill="var(--ill-hill-1)" />
      <path d="M0 168 C 70 140 140 150 210 132 C 270 118 320 136 360 128 L360 240 L0 240Z" fill="var(--ill-hill-2)" />
      <path d="M0 206 C 80 180 160 192 240 178 C 300 168 340 176 360 172 L360 240 L0 240Z" fill="var(--ill-hill-3)" />
      {/* The road to the goal */}
      <path d="M118 240 C 140 214 196 212 196 192 C 196 172 150 170 164 150 C 176 134 214 134 222 118 C 228 106 214 98 220 90" fill="none" stroke="var(--surface)" strokeOpacity={0.85} strokeWidth={7} strokeLinecap="round" />
      <path d="M220 90 l0 -18 l14 6 l-14 6" fill="var(--peach)" stroke="var(--ill-tree)" strokeWidth={1.4} strokeLinejoin="round" />
      <Tree x={64} y={196} s={1.2} />
      <Tree x={88} y={202} s={0.85} />
      <Tree x={300} y={180} s={1.1} />
      <RoundTree x={326} y={186} s={0.9} />
      <RoundTree x={270} y={142} s={0.6} />
    </svg>
  );
}

/** Two trees growing side by side — the Family hero. */
export function TogetherScene({ className }: { className?: string }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg viewBox="0 0 360 240" preserveAspectRatio="xMidYMax slice" aria-hidden="true" className={clsx('block', className)}>
      <defs>
        <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--ill-sky-2)" />
          <stop offset="100%" stopColor="var(--ill-sky-1)" />
        </linearGradient>
      </defs>
      <rect width="360" height="240" fill={`url(#${id}-sky)`} />
      <path d="M180 70 c-10 -14 -32 -8 -30 8 c2 14 30 30 30 30 s28 -16 30 -30 c2 -16 -20 -22 -30 -8z" fill="var(--peach)" opacity={0.85} />
      <path d="M0 150 C 80 120 140 136 200 120 C 260 104 320 124 360 116 L360 240 L0 240Z" fill="var(--ill-hill-1)" />
      <path d="M0 190 C 90 160 170 176 250 160 C 300 150 340 158 360 156 L360 240 L0 240Z" fill="var(--ill-hill-2)" />
      <RoundTree x={150} y={172} s={2} />
      <RoundTree x={208} y={176} s={1.6} />
      <RoundTree x={244} y={182} s={1.1} />
      <path d="M0 214 C 100 194 220 204 360 196 L360 240 L0 240Z" fill="var(--ill-hill-3)" />
    </svg>
  );
}

/** A small sprout for "link another account" and empty states. */
export function Sprout({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" className={className}>
      <ellipse cx="24" cy="40" rx="14" ry="4" fill="var(--ill-hill-2)" />
      <path d="M24 40 V22" stroke="var(--ill-tree)" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M24 26 C 14 26 10 18 12 12 C 20 12 25 18 24 26Z" fill="var(--ill-hill-3)" />
      <path d="M24 22 C 32 22 38 15 36 8 C 28 8 23 14 24 22Z" fill="var(--emerald)" />
    </svg>
  );
}
