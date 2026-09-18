import { forwardRef } from 'react';

// Geometric raven silhouettes as inline SVG.
// Replaces external PNG assets — crisp, scalable, transparent background,
// works perfectly with mix-blend-mode: multiply on the light sheet.
const VARIANTS = {
  hero: (
    <g>
      <ellipse cx="102" cy="108" rx="36" ry="11" />
      <circle cx="134" cy="98" r="12" />
      <polygon points="145,95 162,92 145,102" />
      <path d="M 82,102 Q 56,60 30,36 Q 38,58 52,78 Q 64,94 78,104 Z" />
      <polygon points="68,108 38,102 68,118" />
    </g>
  ),
  positioning: (
    <g>
      <ellipse cx="100" cy="108" rx="30" ry="25" />
      <circle cx="128" cy="82" r="14" />
      <polygon points="141,78 160,74 141,86" />
      <path d="M 90,94 Q 62,76 45,80 Q 70,94 90,104 Z" />
      <polygon points="72,126 46,136 72,130" />
      <line x1="96" y1="132" x2="94" y2="150" stroke="currentColor" strokeWidth="2.5" />
      <line x1="110" y1="132" x2="112" y2="150" stroke="currentColor" strokeWidth="2.5" />
    </g>
  ),
  resolution: (
    <g transform="rotate(-25 100 100)">
      <ellipse cx="100" cy="78" rx="14" ry="32" />
      <circle cx="100" cy="116" r="12" />
      <polygon points="100,128 92,146 108,128" />
      <path d="M 86,62 Q 62,44 50,48 Q 68,60 84,74 Z" />
      <path d="M 114,62 Q 138,44 150,48 Q 132,60 116,74 Z" />
      <polygon points="88,46 82,28 94,44" />
    </g>
  ),
  domains: (
    <g>
      <ellipse cx="100" cy="98" rx="25" ry="36" />
      <circle cx="100" cy="52" r="14" />
      <polygon points="100,37 92,22 113,36" />
      <path d="M 76,84 Q 52,68 38,76 Q 60,88 76,98 Z" />
      <polygon points="90,132 78,154 96,142" />
      <line x1="98" y1="132" x2="97" y2="154" stroke="currentColor" strokeWidth="2.5" />
      <line x1="108" y1="132" x2="109" y2="154" stroke="currentColor" strokeWidth="2.5" />
    </g>
  ),
  finale: (
    <g>
      <ellipse cx="100" cy="105" rx="15" ry="28" />
      <circle cx="100" cy="64" r="12" />
      <polygon points="100,51 93,36 107,36" />
      <path d="M 85,80 Q 60,65 35,52 Q 28,48 22,44 L 30,58 L 42,72 L 56,86 L 72,98 L 84,102 Z" />
      <path d="M 115,80 Q 140,65 165,52 Q 172,48 178,44 L 170,58 L 158,72 L 144,86 L 128,98 L 116,102 Z" />
      <polygon points="100,133 90,155 110,155" />
    </g>
  ),
};

const RavenArt = forwardRef(function RavenArt({ variant, className, id }, ref) {
  return (
    <svg
      ref={ref}
      id={id}
      className={`lp-raven-art ${className || ''}`}
      viewBox="0 0 200 200"
      aria-hidden="true"
      fill="currentColor"
    >
      {VARIANTS[variant]}
    </svg>
  );
});

export default RavenArt;