// The engine's measured results, shown on the public Discover page.
// Engine version 7.0. Every figure comes from one pass through history in
// which each call was made before its outcome was known and each series was
// started from nothing (validation/replay.py; numbers in
// validation/replay/report.json). "Expected" is the share right if the
// series' own record alone had made every call: HEX is credited only with
// what it adds to that.

export const MEASURED_RESULTS = [
  { test: 'Markets: 17 series, 2016–2026, 46,478 calls', event: 'Will the next day’s move be larger than usual? (share right)', hex: '57.9%', control: '57.2% expected' },
  { test: 'Markets: the same calls', event: 'Probability given to what happened, beyond the series’ own record (bits per call)', hex: '+0.0043', control: '0.0030 to 0.0056, clear of zero' },
  { test: 'Currencies never tested before: 10 series, 26,540 calls', event: 'Will the next day’s move be larger than usual? (share right)', hex: '62.1%', control: '61.2% expected' },
  { test: 'Markets: 17 series, 2016–2026, 46,478 calls', event: 'Will the next day close up or down? (share right)', hex: '51.4%', control: '51.2% expected: no verified edge' },
  { test: 'Temperature never tested before: 3 stations, 29,408 days', event: 'Will tomorrow’s high be above today’s? (share right)', hex: '61.0%', control: '54.6% expected' },
  { test: 'Temperature: Chicago, 24,678 days', event: 'Will tomorrow’s high be above today’s? (share right)', hex: '62.9%', control: '50.7% expected' },
  { test: 'Horse racing: 12 jockeys, 13,022 results', event: 'Will the next result be better or worse than the last? (share right)', hex: '74.8%', control: '75.0% expected: no verified edge' },
];

export const MEASURED_NOTE =
  'One pass through history: every call was made before its outcome was known, and every series was started from nothing. '
  + '“Expected” is what the series’ own record gets right without the engine. '
  + 'The 17 market series, the Chicago series and the racing series were used while the engine was being designed; the ten currencies and three temperature stations were never used before this test. '
  + 'Next-day market direction and racing show no verified edge, and the engine reports them as such. The edge on market move size is small. '
  + 'Past results do not guarantee future results. Nothing here is investment advice.';
