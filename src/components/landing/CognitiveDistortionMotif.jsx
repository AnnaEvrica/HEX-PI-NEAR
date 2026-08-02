import { motion } from 'framer-motion';

// Cognitive distortions (jittery squiggles) dissolve as a clean normal curve
// (statistical analysis) draws in over a straight objective-reasoning baseline
// — looping to read "distortions cured by statistics + objective reasoning".
export default function CognitiveDistortionMotif() {
  const distortions = [
    'M0 30 L12 18 L24 38 L36 14 L48 34 L60 20 L72 36',
    'M0 24 L14 40 L26 12 L38 32 L50 16 L62 38 L72 22',
    'M0 28 L11 36 L23 16 L35 40 L47 18 L59 36 L72 24',
  ];
  return (
    <svg viewBox="0 0 72 56" className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
      {/* objective-reasoning baseline — settles straight and holds */}
      <motion.line
        x1="2" y1="34" x2="70" y2="34"
        stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" className="text-foreground/70"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 0.8 }}
        transition={{ duration: 1.1, delay: 0.7, repeat: Infinity, repeatType: 'reverse', repeatDelay: 1.6 }}
      />
      {/* statistical normal curve — draws in as the cure */}
      <motion.path
        d="M2 50 Q 18 50 26 34 T 44 14 T 62 34 Q 68 50 70 50"
        fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" className="text-accent"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 0.95 }}
        transition={{ duration: 1.5, delay: 0.5, ease: 'easeInOut', repeat: Infinity, repeatType: 'reverse', repeatDelay: 1.3 }}
      />
      {/* distortions — jitter then dissolve */}
      {distortions.map((d, i) => (
        <motion.path
          key={i}
          d={d}
          fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="text-foreground/40"
          initial={{ opacity: 0.55 }}
          animate={{ opacity: [0.55, 0.45, 0], x: [0, 1.5, -1, 0] }}
          transition={{ duration: 2.8, delay: i * 0.3, repeat: Infinity, repeatDelay: 0.3 }}
        />
      ))}
    </svg>
  );
}