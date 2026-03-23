'use client';

import { ReactNode } from 'react';
import DigitalClock from './DigitalClock';

export default function AuthHeroPanel({
  children,
  brandTitle = 'Gemura',
  brandSubtitle = 'Milk collection services platform',
}: {
  children?: ReactNode;
  brandTitle?: string;
  brandSubtitle?: string;
}) {
  const particles = Array.from({ length: 32 }, (_, i) => i);
  const nodes = Array.from({ length: 12 }, (_, i) => i);

  return (
    <div className="auth-hero" role="presentation">
      <div className="auth-hero__gradient" aria-hidden="true" />
      <div className="auth-hero__mesh" aria-hidden="true" />

      <div className="auth-hero__particles" aria-hidden="true">
        {particles.map((i) => (
          <span
            key={i}
            className="auth-hero__particle"
            style={{
              left: `${((i * 37 + 11) % 88) + 6}%`,
              top: `${((i * 29 + 5) % 82) + 9}%`,
              animationDelay: `${i * -280}ms`,
            }}
          />
        ))}
      </div>

      <div className="auth-hero__network" aria-hidden="true">
        {nodes.map((n) => (
          <span
            key={n}
            className="auth-hero__node"
            style={{
              left: `${((n * 41 + 19) % 78) + 8}%`,
              top: `${((n * 37 + 3) % 72) + 10}%`,
              animationDelay: `${n * -450}ms`,
            }}
          />
        ))}
      </div>

      <svg className="auth-hero__sparkline" viewBox="0 0 400 120" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="authHeroLine" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(255,255,255,0)" />
            <stop offset="35%" stopColor="rgba(255,255,255,0.45)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.15)" />
          </linearGradient>
          <linearGradient id="authHeroBars" x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.08)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.28)" />
          </linearGradient>
        </defs>

        <g className="auth-hero__bars" opacity="0.85">
          <rect x="24" y="72" width="18" height="40" rx="3" fill="url(#authHeroBars)" />
          <rect x="56" y="48" width="18" height="64" rx="3" fill="url(#authHeroBars)" />
          <rect x="88" y="58" width="18" height="54" rx="3" fill="url(#authHeroBars)" />
          <rect x="120" y="32" width="18" height="80" rx="3" fill="url(#authHeroBars)" />
          <rect x="152" y="62" width="18" height="50" rx="3" fill="url(#authHeroBars)" />
          <rect x="184" y="42" width="18" height="70" rx="3" fill="url(#authHeroBars)" />
          <rect x="216" y="55" width="18" height="57" rx="3" fill="url(#authHeroBars)" />
          <rect x="248" y="38" width="18" height="74" rx="3" fill="url(#authHeroBars)" />
          <rect x="280" y="68" width="18" height="44" rx="3" fill="url(#authHeroBars)" />
          <rect x="312" y="52" width="18" height="60" rx="3" fill="url(#authHeroBars)" />
          <rect x="344" y="44" width="18" height="68" rx="3" fill="url(#authHeroBars)" />
        </g>

        <path
          className="auth-hero__line"
          fill="none"
          stroke="url(#authHeroLine)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M 0 95 Q 80 55 160 78 T 320 42 T 400 68"
        />
      </svg>

      <div className="auth-hero__clock">
        {children ?? <DigitalClock />}
      </div>

      <div className="auth-hero__brand">
        <h2>{brandTitle}</h2>
        <p>{brandSubtitle}</p>
      </div>
    </div>
  );
}

