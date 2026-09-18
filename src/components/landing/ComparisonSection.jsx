import { motion } from 'framer-motion';
import { LANDING_IMAGES } from './landingImages';

export default function ComparisonSection() {
  return (
    <section
      id="difference"
      className="bg-landing-bg py-20 lg:py-32 border-t border-landing-sheet/10"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* Image */}
        <motion.img
          src={LANDING_IMAGES.comparison}
          alt=""
          className="w-full max-w-2xl mx-auto mb-16 h-[25vh] lg:h-[35vh] object-cover"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        />

        {/* Heading */}
        <motion.h2
          className="text-3xl sm:text-5xl lg:text-6xl font-bold text-landing-sheet mb-6 max-w-3xl leading-[1.05]"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          Most AI stops at <span className="text-accent">an answer.</span>
        </motion.h2>
        <motion.p
          className="text-base sm:text-lg text-landing-muted max-w-2xl mb-16 leading-relaxed"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
        >
          Fluent output can sound certain even when the world is not. HEX6-BLE begins where the model
          stops: exposing uncertainty, weighing consequences, and deciding whether — and how — to act.
        </motion.p>

        {/* Two cards */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Conventional AI */}
          <motion.div
            className="bg-landing-sheet-2 p-6 sm:p-8 rounded-sm"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h3 className="text-landing-ink/50 text-xs font-mono uppercase tracking-widest mb-2">
              Conventional AI
            </h3>
            <p className="text-landing-ink text-xl sm:text-2xl font-bold mb-6">
              Optimizes the answer.
            </p>
            <ul className="space-y-3 text-landing-ink/70 text-sm">
              <li className="flex gap-3">
                <span className="text-landing-ink/30">—</span>
                Returns one persuasive prediction
              </li>
              <li className="flex gap-3">
                <span className="text-landing-ink/30">—</span>
                Uncertainty remains implicit
              </li>
              <li className="flex gap-3">
                <span className="text-landing-ink/30">—</span>
                Stops when the output is delivered
              </li>
            </ul>
          </motion.div>

          {/* HEX6-BLE */}
          <motion.div
            className="bg-landing-sheet p-6 sm:p-8 rounded-sm border-l-2 border-accent"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.15 }}
          >
            <h3 className="text-accent text-xs font-mono uppercase tracking-widest mb-2">HEX6-BLE</h3>
            <p className="text-landing-ink text-xl sm:text-2xl font-bold mb-6">
              Optimizes the decision.
            </p>
            <ul className="space-y-3 text-landing-ink/70 text-sm">
              <li className="flex gap-3">
                <span className="text-accent">+</span>
                Models a distribution of outcomes
              </li>
              <li className="flex gap-3">
                <span className="text-accent">+</span>
                Makes confidence and risk visible
              </li>
              <li className="flex gap-3">
                <span className="text-accent">+</span>
                Learns when reality answers back
              </li>
            </ul>
          </motion.div>
        </div>
      </div>
    </section>
  );
}