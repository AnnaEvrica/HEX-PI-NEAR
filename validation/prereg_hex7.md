# HEX PI 7.0 as proposed: predictions written before the run

Written 5 October 2026, before `hex7.py` was first executed.

What is implemented, from the proposal (numbers are its item numbers):
- (2) the null engine: the observer's memory mixture, unchanged;
- (3) continuous relational coordinates: midranks of the present observable in windows of 2, 4, ..., 64 and in all history, z = 2u - 1;
- (4) one order-1 residual in log odds, logit p = logit q0 + beta . Z, estimated online, replacing the 64-state estimator;
- (5) a small hierarchy mixed as one: null, rank residual, rank + admitted interaction, rank + the other observable's ranks, verified resonance;
- (6) calibration allowed to change a call, used only while it has scored better so far;
- (10) reversible influence: a fixed-share family of switching rates {0, 0.001, 0.005, 0.02, 0.05}, aggregated;
- (11) resonance: a product of two observers' coordinates admitted only when its prospective log gain over the additive model exceeds ln(number searched);
- (14) the amplitude (interference) challenger against the classical mixture and the classical interaction.
Not implemented: semantic text, letter-number mappings and the ontology layer (items 11 to 13 in part). There is no frozen text source or question stream to test them on, and nothing can be scored.

Scored on the same calls as the sixth and tenth experiments: right %, log gain over the null in thousandths of a nat with a block bootstrap, strongest tenth stated/right. Comparators: the null, 6.2, 6.4, 6.5.

Predictions
1. Weather direction: 7.0 is right at least 61% of the time (6.4: 56.2%, 6.5: 57.9%), because continuous ranks carried this before.
2. Market move size: 7.0 within 0.3 points of the null and of 6.5 (about 59.8%). No model here has beaten the null on it.
3. Market direction: at chance (50.5 to 51.5%).
4. Racing direction: at the null's level (about 75%).
5. Fixed-share against plain Bayes weights at the top level: a difference under 0.5 thousandths of a nat on every read. The toy two-regime case in the proposal is real but these series do not switch that cleanly.
6. Calibration that may change a call: no gain in right %, and the calls it changes are right less often afterwards, as measured before.
7. Resonance: at most a handful of products admitted; gain over the additive model under 0.5 anywhere.
8. Amplitude challenger: does not beat the classical interaction on any read.
