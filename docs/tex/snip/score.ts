export function scoreCall(stated: number, views: Views, outcome: number, record: Record_): Scored {
  const c = closeness(stated, outcome);
  const before = record.n ? record.mean : START_CLOSENESS;
  return {
    outcome,
    right: sideOf(stated) === outcome,
    log_score: logScore(stated, outcome),
    info_gain: informationGain(stated, views.baseline, outcome),
    closeness: c,
    closeness_baseline: closeness(views.baseline, outcome),
    reward: rewardOf(c, before),
    lesson: lessonOf(c, before),
    reason: reasonFor(stated, views, outcome),
    account: accountOf(stated, views, outcome),
    record: { n: record.n + 1, mean: record.n ? record.mean + (c - record.mean) / (record.n + 1) : c },
  };
}
