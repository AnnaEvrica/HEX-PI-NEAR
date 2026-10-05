export function reasonFor(stated: number, views: Views, outcome: number): Reason | null {
  const right = (p: number) => sideOf(p) === outcome;
  if (right(stated)) return null;
  if (right(views.baseline)) return 'structure';
  const lengths = (views.memories || []).filter((m) => m.label.startsWith('memory:'));
  const at = (ok: boolean) => lengths.map((m, i) => (right(m.p) === ok ? i : -1)).filter((i) => i >= 0);
  const had = at(true), hadNot = at(false);
  if (had.length && hadNot.length) {
    const mean = (v: number[]) => v.reduce((s, x) => s + x, 0) / v.length;
    return mean(had) < mean(hadNot) ? 'change' : 'blip'; // memories are listed shortest first
  }
  const others = [...(views.memories || []).filter((m) => !m.label.startsWith('memory:')), ...(views.readings || [])];
  if (had.length || others.some((v) => right(v.p))) return 'outvoted';
  return 'unseen';
}
