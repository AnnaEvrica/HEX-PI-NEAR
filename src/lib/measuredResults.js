// The engine's measured results, shown on the public Discover page.
// Every figure comes from a walk-forward test (each call made before its
// outcome was known) and is shown beside what it was compared with.
// Source files: validation/ in this repository.

export const MEASURED_RESULTS = [
  { test: 'Markets: 17 series, 2016–2026, 46,937 days', event: 'Is a stated probability accurate? (calibration error)', hex: '0.3%', control: 'lower is better' },
  { test: 'Markets: 17 series, 2016–2026', event: 'Will the next day’s move be larger than usual? (skill over the usual odds)', hex: '3.7%', control: '0.0% on shuffled data' },
  { test: 'Markets: strongest 10% of calls', event: 'Larger-than-usual move, by asset (share right)', hex: '60–73%', control: '48–51% on shuffled data' },
  { test: 'Markets: 17 series, 2016–2026', event: 'Will the next day close up or down? (share right)', hex: '51.0%', control: '50.8% usual odds' },
  { test: 'Markets: 70 five-day calls, Jul–Sep 2026', event: 'Up or down, against a general-purpose AI model (share right)', hex: '54.3%', control: '40.8% AI model' },
  { test: 'Horse racing: 12 jockeys not seen in training, from a cold start', event: 'Will the next result be better or worse than the last? (skill over the usual odds)', hex: '10.3%', control: '5.3% without pre-training' },
  { test: 'Weather: Chicago, 1991–2015, 9,046 days', event: 'Will tomorrow be above its seasonal normal? (share right)', hex: '72.8%', control: '51.1% climatology' },
];

export const MEASURED_NOTE =
  'Walk-forward tests: every call was made before its outcome was known. Next-day market direction tested at chance, and the engine reports it as such. '
  + 'The comparison with an AI model rests on 70 calls and is preliminary. On weather, a standard persistence model reaches a similar rate. '
  + 'Past results do not guarantee future results. Nothing here is investment advice.';
