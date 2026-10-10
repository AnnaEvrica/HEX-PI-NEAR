import { forwardRef } from 'react';

const RAVEN_IMAGES = {
  hero: 'https://media.base44.com/images/public/69eef3d514386627566a9bf6/a5e96338b_ChatGPTImageSep302026at09_23_15AM.png',
  positioning: 'https://media.base44.com/images/public/69eef3d514386627566a9bf6/e5b6f916b_r1.png',
  resolution: 'https://media.base44.com/images/public/69eef3d514386627566a9bf6/195b6c78f_r5.png',
  domains: 'https://media.base44.com/images/public/69eef3d514386627566a9bf6/eb37e605b_r2.png',
  finale: 'https://media.base44.com/images/public/69eef3d514386627566a9bf6/dedf5bbd6_r3.png',
};

// SVG filter: turns near-white pixels transparent so the raven sits directly
// on the dark landing background instead of inside a white box.
const WHITE_REMOVAL_FILTER = (
  <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
    <defs>
      <filter id="raven-kill-white">
        <feColorMatrix
          type="matrix"
          values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  -0.9 -0.9 -0.9 1 0.15"
        />
      </filter>
    </defs>
  </svg>
);

const RavenArt = forwardRef(function RavenArt({ variant, className, id }, ref) {
  return (
    <>
      {WHITE_REMOVAL_FILTER}
      <img
        ref={ref}
        id={id}
        src={RAVEN_IMAGES[variant]}
        alt=""
        aria-hidden="true"
        className={`lp-raven-art ${className || ''}`}
        decoding="async"
      />
    </>
  );
});

export default RavenArt;