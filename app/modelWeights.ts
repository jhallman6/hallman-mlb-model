export function workbookPaWeights(
  hitterSeasonPa: number,
  hitterZipsPa: number,
  pitcherSeasonTbf: number,
  pitcherRosTbf: number,
) {
  const clampRate = (value: number) => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
  const hitterPaPct = clampRate(hitterZipsPa > 0 ? hitterSeasonPa / hitterZipsPa : 0);
  const pitcherFullSeasonTbf = pitcherSeasonTbf + pitcherRosTbf;
  const pitcherPaPct = clampRate(pitcherFullSeasonTbf > 0 ? pitcherSeasonTbf / pitcherFullSeasonTbf : 0);
  const paPct = clampRate((hitterPaPct + pitcherPaPct) / 2);
  return { hitterPaPct, pitcherPaPct, paPct, rosPaPct: 1 - paPct };
}
