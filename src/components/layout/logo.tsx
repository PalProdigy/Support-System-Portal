'use client'

import { useEffect, useState } from 'react'

interface LogoProps {
  className?: string
}

/** NHQ Distributions logo mark — watches the `dark` class on <html> so the
 * NH wordmark swaps color live, without needing a shared theme context. */
export function Logo({ className = 'h-14 w-auto' }: LogoProps) {
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    const root = document.documentElement
    setIsDark(root.classList.contains('dark'))
    const observer = new MutationObserver(() => setIsDark(root.classList.contains('dark')))
    observer.observe(root, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  return (
    <svg
        className={className}
        viewBox="0 0 320 140"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
    >
      {/* NH text */}
      <text
          x="15"
          y="85"
          fontFamily="system-ui, -apple-system, sans-serif"
          fontWeight="900"
          fontSize="62"
          fill={isDark ? '#FFFFFF' : '#111111'}
          letterSpacing="-2px"
      >
        NH
      </text>

      {/* Distributions text */}
      <text
          x="13"
          y="118"
          fontFamily="system-ui, -apple-system, sans-serif"
          fontWeight="800"
          fontStyle="italic"
          fontSize="21"
          fill="#D32F2F"
          letterSpacing="4px"
      >
        DISTRIBUTIONS
      </text>

      {/* 3D sphere with concentric grey orbital rings */}
      <g clipPath="url(#ringsClip)">
        {/* Ring 1 */}
        <ellipse
            cx="150"
            cy="60"
            rx="38"
            ry="17"
            transform="rotate(-28, 150, 60)"
            stroke="#9E9E9E"
            strokeWidth="2.5"
            strokeDasharray="4 2"
        />
        {/* Ring 2 */}
        <ellipse
            cx="150"
            cy="60"
            rx="52"
            ry="23"
            transform="rotate(-28, 150, 60)"
            stroke="#757575"
            strokeWidth="3.2"
        />
        {/* Ring 3 */}
        <ellipse
            cx="150"
            cy="60"
            rx="66"
            ry="29"
            transform="rotate(-28, 150, 60)"
            stroke="#BDBDBD"
            strokeWidth="1.8"
        />
      </g>

      {/* Red Glossy Sphere */}
      <circle cx="145" cy="65" r="30" fill="url(#sphereGradient)" filter="url(#sphereShadow)" />

      {/* White portion of the Swooping Orbit Arc (on the red sphere) */}
      <path
          d="M 125 65 C 125 50, 168 50, 172 68"
          stroke="#FFFFFF"
          strokeWidth="4"
          strokeLinecap="round"
          fill="none"
      />

      {/* Red portion of the Swooping Orbit Arc (outside the red sphere) */}
      <path
          d="M 171 67 C 176 85, 190 110, 190 130"
          stroke="#D32F2F"
          strokeWidth="4"
          strokeLinecap="round"
          fill="none"
      />

      {/* Definitions for Gradients and Shadows */}
      <defs>
        {/* Clip path to remove the downside (bottom-left) of the grey orbital rings */}
        <clipPath id="ringsClip">
          <polygon points="80,0 320,0 320,110 135,110 135,55 80,55" />
        </clipPath>
        {/* Radial gradient for the red glossy 3D ball */}
        <radialGradient id="sphereGradient" cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#FF8A80" />
          <stop offset="35%" stopColor="#E53935" />
          <stop offset="85%" stopColor="#B71C1C" />
          <stop offset="100%" stopColor="#7F0000" />
        </radialGradient>
        {/* Soft drop shadow for the sphere */}
        <filter id="sphereShadow" x="95" y="25" width="100" height="100" filterUnits="userSpaceOnUse">
          <feDropShadow dx="1" dy="4" stdDeviation="4" floodColor="#000000" floodOpacity="0.18" />
        </filter>
      </defs>
    </svg>
  )
}
