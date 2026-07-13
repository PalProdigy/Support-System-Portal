'use client';

import { useEffect, useMemo, useState } from 'react';

interface NHQLoaderProps {
    /** Optional callback triggered when loading completes (if duration is set) */
    onComplete?: () => void;
    /** Optional duration in milliseconds. If specified, the loader will auto-finish */
    duration?: number;
}

const STYLE_ID = 'nhq-loader-animations';
const STYLE_CSS = `
  @keyframes nhq-orbit-cw { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
  @keyframes nhq-orbit-ccw { from { transform: rotate(0deg); } to { transform: rotate(-360deg); } }
  @keyframes nhq-shimmer { from { transform: translateX(-100%); } to { transform: translateX(220%); } }

  .nhq-ring-1 { transform-origin: 100px 100px; animation: nhq-orbit-cw 16s linear infinite; }
  .nhq-ring-2 { transform-origin: 100px 100px; animation: nhq-orbit-ccw 22s linear infinite; }
  .nhq-ring-3 { transform-origin: 100px 100px; animation: nhq-orbit-cw 28s linear infinite; }
  .nhq-shimmer { animation: nhq-shimmer 1.8s ease-in-out infinite; }

  @media (prefers-reduced-motion: reduce) {
    .nhq-ring-1, .nhq-ring-2, .nhq-ring-3, .nhq-shimmer { animation: none; }
  }
`;

// Real phases derived from actual progress — not a decorative loop — so the
// label always tells the truth about how far along the load really is.
function phaseFor(progress: number): string {
    if (progress >= 100) return 'Ready';
    if (progress >= 66) return 'Finalizing';
    if (progress >= 33) return 'Syncing cases';
    return 'Connecting';
}

/**
 * NHQLoader — full-screen branded boot / transition screen for the NHQ
 * Support Portal. The centerpiece revives the sidebar's own orbit mark
 * (grey rings orbiting the red sphere) as a living animation instead of a
 * generic shape carousel, so the loading moment feels like the same brand
 * as the rest of the app rather than a stock loading-spinner aesthetic.
 * Self-contained: no external fonts or images, so it can never 404.
 *
 * Props are unchanged from the original drop-in component (`onComplete`,
 * `duration`), so both usage patterns keep working as-is:
 *   - indeterminate: <NHQLoader /> while some real isLoading flag is true
 *   - simulated timer: <NHQLoader duration={3000} onComplete={...} />
 */
export default function NHQLoader({ onComplete, duration }: NHQLoaderProps) {
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        if (document.getElementById(STYLE_ID)) return;
        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.innerHTML = STYLE_CSS;
        document.head.appendChild(style);
    }, []);

    useEffect(() => {
        if (!duration) {
            // Endless loop mode: simulate progressive load up to 98%
            const interval = setInterval(() => {
                setProgress((prev) => {
                    if (prev >= 98) return 98;
                    return prev + (100 - prev) * 0.1;
                });
            }, 1000);
            return () => clearInterval(interval);
        } else {
            // Finite duration mode
            const startTime = Date.now();
            const interval = setInterval(() => {
                const elapsed = Date.now() - startTime;
                const currentProgress = Math.min((elapsed / duration) * 100, 100);
                setProgress(currentProgress);

                if (elapsed >= duration) {
                    clearInterval(interval);
                    if (onComplete) onComplete();
                }
            }, 50);
            return () => clearInterval(interval);
        }
    }, [duration, onComplete]);

    const phase = useMemo(() => phaseFor(progress), [progress]);

    return (
        <div
            role="status"
            aria-live="polite"
            aria-busy="true"
            className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden text-white"
            style={{ background: 'radial-gradient(ellipse at center, #1a1014 0%, #0b0d12 65%)' }}
        >
            {/* Faint hairline grid — pure CSS, no external texture request */}
            <div
                className="absolute inset-0 pointer-events-none opacity-[0.05]"
                style={{
                    backgroundImage:
                        'linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)',
                    backgroundSize: '34px 34px',
                }}
            />

            {/* Orbit mark — the sidebar logo's rings + sphere, brought to life */}
            <div className="relative w-40 h-40 sm:w-48 sm:h-48">
                <svg viewBox="0 0 200 200" className="w-full h-full overflow-visible">
                    <defs>
                        <radialGradient id="nhqSphere" cx="35%" cy="30%" r="70%">
                            <stop offset="0%" stopColor="#FF8A80" />
                            <stop offset="35%" stopColor="#E53935" />
                            <stop offset="85%" stopColor="#B71C1C" />
                            <stop offset="100%" stopColor="#7F0000" />
                        </radialGradient>
                        <filter id="nhqSphereShadow" x="-50%" y="-50%" width="200%" height="200%">
                            <feDropShadow dx="0" dy="3" stdDeviation="6" floodColor="#000000" floodOpacity="0.45" />
                        </filter>
                    </defs>

                    {/* Orbital rings — counter-rotating at different speeds for depth */}
                    <ellipse className="nhq-ring-1" cx="100" cy="100" rx="52" ry="23" stroke="#9E9E9E" strokeWidth="1.6" strokeDasharray="3 3" fill="none" opacity="0.55" />
                    <ellipse className="nhq-ring-2" cx="100" cy="100" rx="70" ry="31" stroke="#BDBDBD" strokeWidth="2" fill="none" opacity="0.4" />
                    <ellipse className="nhq-ring-3" cx="100" cy="100" rx="88" ry="39" stroke="#757575" strokeWidth="1.2" strokeDasharray="1 5" fill="none" opacity="0.35" />

                    {/* Fixed glossy sphere — the brand mark's anchor point */}
                    <circle cx="100" cy="100" r="30" fill="url(#nhqSphere)" filter="url(#nhqSphereShadow)" />
                    <path d="M 82 100 C 82 86, 118 86, 122 102" stroke="#FFFFFF" strokeWidth="3.5" strokeLinecap="round" fill="none" opacity="0.9" />
                </svg>
            </div>

            {/* Wordmark */}
            <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.35em] text-zinc-400">
                NHQ <span className="text-red-500">Distributions</span>
            </p>

            {/* Progress rail */}
            <div className="absolute bottom-16 flex flex-col items-center gap-2.5 w-56">
                <div className="relative w-full h-1 rounded-full overflow-hidden bg-white/10">
                    <div
                        className="h-full rounded-full bg-gradient-to-r from-red-800 via-red-500 to-red-400 transition-[width] duration-300 ease-out"
                        style={{ width: `${progress}%` }}
                    >
                        <span className="nhq-shimmer absolute inset-y-0 left-0 w-1/3 bg-white/30 blur-[2px]" />
                    </div>
                </div>
                <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-zinc-500">
                    <span>{phase}</span>
                    <span className="text-zinc-700">·</span>
                    <span className="text-zinc-300 font-semibold tabular-nums">{Math.round(progress)}%</span>
                </div>
            </div>
        </div>
    );
}
