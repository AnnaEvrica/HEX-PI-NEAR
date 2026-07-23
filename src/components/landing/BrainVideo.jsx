import { useEffect, useRef } from 'react';

// React's `muted` prop is not reliably applied to <video>, and without muted
// browsers block autoplay — so the clip appears not to load. We force muted
// and call play() imperatively via a ref to guarantee autoplay.
export default function BrainVideo() {
  const ref = useRef(null);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    v.muted = true;
    const tryPlay = () => { v.play().catch(() => {}); };
    tryPlay();
    v.addEventListener('loadeddata', tryPlay, { once: true });
    return () => v.removeEventListener('loadeddata', tryPlay);
  }, []);

  return (
    <video
      ref={ref}
      src="https://media.base44.com/videos/public/69eef3d514386627566a9bf6/51e8e4cc9_u3683223828_an_hd_photo_of_a_brain_with_two_hemispheres_re_a42b0d40-0b05-42d1-a5dd-e02cbb9078fc_0.mp4"
      autoPlay loop muted playsInline preload="auto"
      className="w-full max-w-[22rem] sm:max-w-[30rem] lg:max-w-[40rem] rounded-lg shadow-[0_0_40px_rgba(255,255,255,0.12),0_14px_40px_rgba(0,0,0,0.5)] ring-1 ring-white/20"
    />
  );
}