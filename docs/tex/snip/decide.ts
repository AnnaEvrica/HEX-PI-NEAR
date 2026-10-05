export function decide(read: ReadName, t: Tally, current: EngineId): ReadStatus {
  const st: ReadStatus = {
    read, live_engine: current, paired_calls: t.calls, paired_days: t.days,
    gain: null, gain_low: null, gain_high: null,
    bits_control: null, bits_control_low: null, bits_control_high: null, bits_candidate: null, bits_candidate_low: null, bits_candidate_high: null, verified: null,
    hit_control: null, hit_candidate: null, hit_baseline: null, stated_control: null, stated_candidate: null, closeness_control: null, closeness_candidate: null,
    progress_control: null, progress_candidate: null, lesson_control: null, lesson_candidate: null,
    reasons_control: { ...(t.reasons_control || {}) }, reasons_candidate: { ...(t.reasons_candidate || {}) }, decision: 'hold', reason: '',
  };
  if (!t.calls) { st.reason = 'no scored calls yet'; return st; }
  const r4 = (v: number) => Number(v.toFixed(4)), r5 = (v: number) => Number(v.toFixed(5)), per = (v: number) => v / t.calls;
  const v = clusteredMean(t.versus, Z), c0 = clusteredMean(t.over_null_control, Z), k0 = clusteredMean(t.over_null_candidate, Z), h = clusteredMean(t.hits, Z);
  if (v) { st.gain = r5(v.mean); st.gain_low = r5(v.low); st.gain_high = r5(v.high); }
  if (c0) { st.bits_control = r5(c0.mean / LN2); st.bits_control_low = r5(c0.low / LN2); st.bits_control_high = r5(c0.high / LN2); }
  if (k0) { st.bits_candidate = r5(k0.mean / LN2); st.bits_candidate_low = r5(k0.low / LN2); st.bits_candidate_high = r5(k0.high / LN2); }
  st.hit_control = r4(per(t.hits_control)); st.hit_candidate = r4(per(t.hits_candidate)); st.hit_baseline = r4(per(t.hits_baseline));
  st.stated_control = r4(per(t.stated_control)); st.stated_candidate = r4(per(t.stated_candidate));
  st.closeness_control = r5(per(t.closeness_control)); st.closeness_candidate = r5(per(t.closeness_candidate));
  st.progress_control = r5(per(t.progress_control)); st.progress_candidate = r5(per(t.progress_candidate));
  st.lesson_control = r5(per(t.lesson_control)); st.lesson_candidate = r5(per(t.lesson_candidate));

  const enough = t.calls >= MIN_PAIRED_CALLS && t.days >= MIN_PAIRED_DAYS && !!v;
  const bits = (x: number) => (x / LN2 * 1000).toFixed(1);
  const span = v ? `[${bits(v.low)}, ${bits(v.high)}]` : '';
  if (!enough) {
    st.reason = `${t.calls} of ${MIN_PAIRED_CALLS} paired calls over ${t.days} of ${MIN_PAIRED_DAYS} days: no decision yet`;
  } else if (current === CONTROL_ENGINE && v!.low > 0 && t.hits_candidate < t.hits_control) {
    st.reason = `7.0 gains ${bits(v!.mean)} thousandths of a bit per call over 6.5 but is right less often (${(st.hit_candidate! * 100).toFixed(1)}% against ${(st.hit_control! * 100).toFixed(1)}%), so 6.5 stays`;
  } else if (current === CONTROL_ENGINE && v!.low > 0) {
    st.decision = 'promote'; st.live_engine = CANDIDATE_ENGINE;
    st.reason = `7.0 gains ${bits(v!.mean)} thousandths of a bit per call over 6.5 ${span}; the interval excludes zero`;
  } else if (current === CANDIDATE_ENGINE && v!.high < 0) {
    st.decision = 'demote'; st.live_engine = CONTROL_ENGINE;
    st.reason = `6.5 gains ${bits(-v!.mean)} thousandths of a bit per call over 7.0; the interval excludes zero`;
  } else if (current === CANDIDATE_ENGINE && h && h.high < 0) {
    st.decision = 'demote'; st.live_engine = CONTROL_ENGINE;
    st.reason = `7.0 was right less often than 6.5 (${(st.hit_candidate! * 100).toFixed(1)}% against ${(st.hit_control! * 100).toFixed(1)}%); the interval excludes zero`;
  } else if (current === CONTROL_ENGINE) {
    st.reason = `7.0 over 6.5: ${bits(v!.mean)} thousandths of a bit per call ${span}: not clearly ahead, so 6.5 stays`;
  } else {
    st.reason = `7.0 over 6.5: ${bits(v!.mean)} thousandths of a bit per call ${span}: not clearly behind, so 7.0 stays`;
  }
  // a verified edge: the version that will be shown gains over the null by a margin clear of zero.
  // The ledger's own record settles it only when it is decisive either way; until then what was
  // established before it stands (the caller keeps the earlier status when this is null).
  const shown = st.live_engine === CANDIDATE_ENGINE ? k0 : c0;
  st.verified = enough && shown ? (shown.low > 0 ? true : shown.high < 0 ? false : null) : null;
  return st;
}
