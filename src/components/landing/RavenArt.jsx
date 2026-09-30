import { forwardRef } from 'react';

const RAVEN_IMAGES = {
  hero: 'https://media.base44.com/images/public/69eef3d514386627566a9bf6/a5e96338b_ChatGPTImageSep302026at09_23_15AM.png',
  positioning: 'https://media.base44.com/images/public/69eef3d514386627566a9bf6/e5b6f916b_r1.png',
  resolution: 'https://media.base44.com/images/public/69eef3d514386627566a9bf6/195b6c78f_r5.png',
  domains: 'https://media.base44.com/images/public/69eef3d514386627566a9bf6/eb37e605b_r2.png',
  finale: 'https://media.base44.com/images/public/69eef3d514386627566a9bf6/dedf5bbd6_r3.png',
};

const RavenArt = forwardRef(function RavenArt({ variant, className, id }, ref) {
  return (
    <img
      ref={ref}
      id={id}
      src={RAVEN_IMAGES[variant]}
      alt=""
      aria-hidden="true"
      className={`lp-raven-art ${className || ''}`}
      decoding="async"
    />
  );
});

export default RavenArt;