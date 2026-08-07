export function workbookPaWeights(
  hitterSeasonPa: number,
  hitterZipsPa: number,
  pitcherSeasonTbf: number,
  pitcherRosTbf: number,
) {
  const hitterPaPct = hitterZipsPa > 0 ? hitterSeasonPa / hitterZipsPa : 0;
  const pitcherFullSeasonTbf = pitcherSeasonTbf + pitcherRosTbf;
  const pitcherPaPct = pitcherFullSeasonTbf > 0 ? pitcherSeasonTbf / pitcherFullSeasonTbf : 0;
  const paPct = Math.min(1, Math.max(0, (hitterPaPct + pitcherPaPct) / 2));
  return { hitterPaPct, pitcherPaPct, paPct, rosPaPct: 1 - paPct };
}
