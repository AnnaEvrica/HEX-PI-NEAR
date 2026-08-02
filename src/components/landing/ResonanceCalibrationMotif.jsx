import { motion } from 'framer-motion';

// An experiential bias (the tilted beam) is leveled by resonance ripples
// emanating from the fulcrum — looping to read "bias weight calibrated
// by resonance".
export default function ResonanceCalibrationMotif() {
  return (
    <svg viewBox="0 0 72 56" className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
      {/* resonance ripples — calibration signal from the pivot */}
      {[0, 1, 2].map((i) => (
        <motion.circle
          key={i}
          cx="36" cy="34" fill="none" stroke="currentColor" strokeWidth="0.9" className="text-accent/50"
          initial={{ r: 2, opacity: 0 }}
          animate={{ r: [2, 30], opacity: [0.5, 0] }}
          transition={{ duration: 3, delay: i * 1, repeat: Infinity, ease: 'easeOut' }}
        />
      ))}
      {/* fulcrum */}
      <path d="M30 46 L42 46 L36 34 Z" fill="currentColor" className="text-foreground/60" />
      {/* beam — tilts (bias) then levels (calibrated) */}
      <motion.g
        style={{ transformOrigin: '36px 34px' }}
        animate={{ rotate: [13, -13, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      >
        <line x1="8" y1="34" x2="64" y2="34" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" className="text-accent" />
        <circle cx="8" cy="34" r="3.6" fill="currentColor" className="text-accent" />
        <circle cx="64" cy="34" r="3.6" fill="currentColor" className="text-accent" />
      </motion.g>
    </svg>
  );
}