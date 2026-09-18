import { motion } from 'framer-motion';
import { LANDING_IMAGES } from './landingImages';

const PROOFS = [
  {
    title: 'Probability attached',
    body: 'Every recommendation carries the confidence behind it.',
  },
  {
    title: 'Constraints explicit',
    body: 'Risk is visible before action, not explained after failure.',
  },
  {
    title: 'Outcomes scored',
    body: 'What happened is measured against what was expected.',
  },
];

export default function InspectSection() {
  return (
    <section className="bg-landing-bg py-20 lg:py-32 border-t border-landing-sheet/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* Image */}
        <motion.img
          src={LANDING_IMAGES.inspect}
          alt=""
          className="w-full max-w-3xl mx-auto mb-16 h-[25vh] lg:h-[35vh] object-cover"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        />

        {/* Header */}
        <motion.h2
          className="text-3xl sm:text-5xl font-bold text-landing-sheet mb-12 leading-[1.05]"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          Built to be inspected
        </motion.h2>

        {/* Proof points */}
        <div className="grid md:grid-cols-3 gap-6">
          {PROOFS.map((p, i) => (
            <motion.div
              key={p.title}
              className="border-l-2 border-accent/40 pl-6"
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
            >
              <h3 className="text-landing-sheet text-lg font-bold mb-2">{p.title}</h3>
              <p className="text-landing-muted text-sm leading-relaxed">{p.body}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}