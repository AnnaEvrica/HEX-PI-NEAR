import { motion } from 'framer-motion';
import { LANDING_IMAGES } from './landingImages';

const DOMAINS = [
  {
    title: 'Trading',
    body: 'Turn market forecasts into calibrated timing, exposure, and restraint — without mistaking confidence for certainty.',
  },
  {
    title: 'Learning',
    body: 'Update confidence as new evidence arrives, while preserving what the system knew at each decision point.',
  },
  {
    title: 'Assisting',
    body: 'Apply the same transparent reasoning to plans and personal choices where consequences matter.',
  },
];

export default function DomainsSection() {
  return (
    <section className="bg-landing-bg py-20 lg:py-32 border-t border-landing-sheet/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* Image */}
        <motion.img
          src={LANDING_IMAGES.domains}
          alt=""
          className="w-full max-w-3xl mx-auto mb-16 h-[25vh] lg:h-[35vh] object-cover"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        />

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <p className="text-accent font-mono text-sm mb-2">One engine / Many domains</p>
          <h2 className="text-3xl sm:text-5xl font-bold text-landing-sheet mb-12 leading-[1.05]">
            Different questions. The same <em className="text-accent not-italic">discipline.</em>
          </h2>
        </motion.div>

        {/* Domain cards */}
        <div className="grid md:grid-cols-3 gap-6">
          {DOMAINS.map((d, i) => (
            <motion.div
              key={d.title}
              className="bg-landing-sheet p-6 sm:p-8 rounded-sm"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
            >
              <h3 className="text-landing-ink text-xl font-bold mb-3">{d.title}</h3>
              <p className="text-landing-ink/70 text-sm leading-relaxed">{d.body}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}