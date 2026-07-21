import { motion } from 'framer-motion';

// The six laws — reframed so each is mutually supportive across three levels:
//   For you       — the individual using it
//   For everyone  — the collective sharing one intelligence
//   Naturally     — how it mirrors an organic, living process
// This makes every future decision obvious: if it serves all three, it's right.

const LAWS = [
  {
    n: '1',
    title: 'Knowledge is permanent. Thinking is temporary.',
    you: 'Your knowledge accumulates across every conversation; every thought is fresh and untainted.',
    everyone: 'Shared truth persists — passing opinions never calcify into false memory.',
    naturally: 'The soil deepens over seasons; each year\'s growth rises and falls.',
  },
  {
    n: '2',
    title: 'There is only one intelligence.',
    you: 'You engage one coherent mind — not a committee of fragmented tools.',
    everyone: 'Every person\'s experience nourishes the same living intelligence.',
    naturally: 'One root system feeds every branch.',
  },
  {
    n: '3',
    title: 'Thinking never changes knowledge directly.',
    you: 'You\'re never misled by a confident-sounding hallucination becoming permanent.',
    everyone: 'The shared knowledge stays trustworthy — only validated experience enters it.',
    naturally: 'The tree absorbs only what has ripened, not every passing wind.',
  },
  {
    n: '4',
    title: 'Every thinking mode asks a different question.',
    you: 'You choose the lens that fits the moment — possibilities, or meaning.',
    everyone: 'The two modes complement rather than compete, covering more ground together.',
    naturally: 'Two eyes give depth — each sees differently, together they see fully.',
  },
  {
    n: '5',
    title: 'Knowledge never chooses. Thinking chooses.',
    you: 'The system never biases what it knows; it helps you decide without pre-deciding for you.',
    everyone: 'The foundation stays neutral — no one\'s priorities override another\'s.',
    naturally: 'The soil doesn\'t choose which seed grows; the gardener does.',
  },
  {
    n: '6',
    title: 'Every thinking mode follows the same lifecycle.',
    you: 'Switching modes never loses your place — the cycle continues seamlessly.',
    everyone: 'One rhythm binds every interaction, so the system stays coherent across all.',
    naturally: 'The seasons turn the same for every field — only the crop differs.',
  },
];

function LawCard({ law, index }) {
  return (
    <motion.div
      className="border border-border bg-card p-5 sm:p-6 space-y-4"
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.5, delay: (index % 3) * 0.1 }}
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl font-bold text-accent leading-none">{law.n}</span>
        <h3 className="text-sm sm:text-base font-bold leading-snug pt-0.5">{law.title}</h3>
      </div>
      <div className="space-y-2.5 text-xs sm:text-sm">
        <div className="flex gap-2">
          <span className="text-accent font-bold shrink-0 w-16">For you</span>
          <span className="text-secondary leading-relaxed">{law.you}</span>
        </div>
        <div className="flex gap-2">
          <span className="text-accent font-bold shrink-0 w-16">For all</span>
          <span className="text-secondary leading-relaxed">{law.everyone}</span>
        </div>
        <div className="flex gap-2">
          <span className="text-accent font-bold shrink-0 w-16">Naturally</span>
          <span className="text-secondary leading-relaxed">{law.naturally}</span>
        </div>
      </div>
    </motion.div>
  );
}

export default function ConstitutionSection() {
  return (
    <section
      id="constitution"
      className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24 md:py-28 space-y-10 sm:space-y-14"
    >
      <motion.div
        className="space-y-4 text-center"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.6 }}
      >
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-sm bg-accent/10 border border-accent/30">
          <span className="text-sm font-bold text-accent">The Constitution</span>
        </div>
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight">
          Six laws that make every decision obvious
        </h2>
        <p className="text-base sm:text-lg text-secondary max-w-2xl mx-auto leading-relaxed">
          Each law serves the individual, the collective, and the living process at once —
          so the system grows the way anything alive does: mutually, organically, by mutual support.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {LAWS.map((law, i) => (
          <LawCard key={law.n} law={law} index={i} />
        ))}
      </div>
    </section>
  );
}