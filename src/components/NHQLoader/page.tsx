import { useEffect, useState } from 'react';

interface NHQLoaderProps {
    /** Optional callback triggered when loading completes (if duration is set) */
    onComplete?: () => void;
    /** Optional duration in milliseconds. If specified, the loader will auto-finish */
    duration?: number;
}

/**
 * NHQLoader - High Fidelity Loading screen mimicking the NHQ Distributions sequence.
 */
export default function NHQLoader({ onComplete, duration }: NHQLoaderProps) {
    const [progress, setProgress] = useState(0);

    // Injected CSS for easy plug-and-play installation without editing CSS files manually
    useEffect(() => {
        const styleId = 'nhq-loader-animations';
        if (!document.getElementById(styleId)) {
            const style = document.createElement('style');
            style.id = styleId;
            style.innerHTML = `
        @font-face {
            font-family: 'Digital';
            src: url('https://fonts.cdnfonts.com/s/14889/DigitalNumbers-Regular.woff') format('woff');
        }
        .digital-font {
            font-family: 'Digital', monospace;
        }
        .step {
            opacity: 0;
            position: absolute;
            animation: sequenceLoop 4.5s infinite;
        }
        .step-1 { animation-delay: 0s; }
        .step-2 { animation-delay: 1.5s; }
        .step-3 { animation-delay: 3s; }

        @keyframes sequenceLoop {
            0%, 30% { opacity: 1; transform: scale(1); }
            33.33%, 100% { opacity: 0; transform: scale(0.9); }
        }

        .shape-item {
            opacity: 0;
            animation: shapeSequence 1.5s infinite;
        }
        .shape-triangle { animation-delay: 1.5s; }
        .shape-circle { animation-delay: 1.9s; }
        .shape-square { animation-delay: 2.3s; }

        @keyframes shapeSequence {
            0% { opacity: 0; transform: translateY(10px); }
            10%, 40% { opacity: 1; transform: translateY(0); }
            50%, 100% { opacity: 0; transform: translateY(-10px); }
        }

        @keyframes digitScroll {
            from { transform: translateY(0); }
            to { transform: translateY(-90%); }
        }
        .bg-gradient-custom {
            background: radial-gradient(circle at center, #1a1a1a 0%, #000 100%);
        }
      `;
            document.head.appendChild(style);
        }
    }, []);

    // Handle duration and progress calculations
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

    return (
        <div className="fixed inset-0 bg-black text-white flex flex-col items-center justify-center overflow-hidden bg-gradient-custom z-50">

            {/* Background Carbon Fiber Grid Decoration */}
            <div className="absolute inset-0 pointer-events-none opacity-20">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]"></div>
            </div>

            {/* Main Animated Sequence viewport */}
            <div className="relative w-64 h-64 flex items-center justify-center">

                {/* Step 1: NHQ Logo & Subtext */}
                <div className="step step-1 flex flex-col items-center justify-center">
                    <h1 className="text-6xl font-black tracking-tighter text-blue-500 drop-shadow-[0_0_15px_rgba(59,130,246,0.5)]">
                        NHQ
                    </h1>
                    <p className="text-xs uppercase tracking-[0.4em] mt-4 text-blue-300/50">DISTRIBUTIONS</p>
                </div>

                {/* Step 2: Geometric Shapes */}
                <div className="step step-2 flex items-center justify-center gap-8">
                    {/* Triangle */}
                    <div className="shape-item shape-triangle">
                        <svg className="text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.6)]" fill="none" height="40" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="40">
                            <path d="M3 20h18L12 4z"></path>
                        </svg>
                    </div>
                    {/* Circle */}
                    <div className="shape-item shape-circle">
                        <div className="w-10 h-10 border-2 border-emerald-400 rounded-full shadow-[0_0_8px_rgba(52,211,153,0.6)]"></div>
                    </div>
                    {/* Square */}
                    <div className="shape-item shape-square">
                        <div className="w-10 h-10 border-2 border-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]"></div>
                    </div>
                </div>

                {/* Step 3: Digital Digits */}
                <div className="step step-3 flex flex-col items-center">
                    <div className="text-5xl digital-font text-amber-400 drop-shadow-[0_0_10px_rgba(251,191,36,0.6)] flex gap-1">
            <span className="digit-container overflow-hidden h-[1.2em]">
              <div
                  className="flex flex-col"
                  style={{ animation: 'digitScroll 0.5s infinite steps(10)' }}
              >
                <span>0</span><span>1</span><span>2</span><span>3</span><span>4</span><span>5</span><span>6</span><span>7</span><span>8</span><span>9</span>
              </div>
            </span>
                        <span className="digit-container overflow-hidden h-[1.2em]">
              <div
                  className="flex flex-col"
                  style={{ animation: 'digitScroll 0.15s infinite steps(10)' }}
              >
                <span>0</span><span>1</span><span>2</span><span>3</span><span>4</span><span>5</span><span>6</span><span>7</span><span>8</span><span>9</span>
              </div>
            </span>
                        <span className="text-3xl self-end mb-1 ml-1 opacity-50 font-bold font-sans">%</span>
                    </div>
                </div>
            </div>

            {/* Loading Progress Bar */}
            <div className="absolute bottom-16 flex flex-col items-center gap-3">
                <div className="w-48 bg-slate-900 h-1 rounded-full overflow-hidden border border-slate-950">
                    <div
                        className="h-full bg-gradient-to-r from-blue-500 via-emerald-500 to-amber-500 transition-all duration-300"
                        style={{ width: `${progress}%` }}
                    ></div>
                </div>
                <div className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">
                    Loading Data ... <span className="text-slate-300 font-bold">{Math.round(progress)}%</span>
                </div>
            </div>

        </div>
    );
}