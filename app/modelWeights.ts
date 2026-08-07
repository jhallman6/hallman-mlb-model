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

export function applyRateOverrides<TRow extends {k:number;bb:number;hr:number;babip:number;nonHrHit:number;out:number}>(
  row: TRow,
  override?: Partial<Pick<TRow,"k"|"bb"|"hr"|"babip">>,
) {
  if (!override) return row;
  const k=override.k??row.k,bb=override.bb??row.bb,hr=override.hr??row.hr,babip=override.babip??row.babip;
  const nonHrHit=Math.max(0,babip*Math.max(.05,1-k-bb-hr-.01));
  const out=Math.max(.05,1-(bb+hr+nonHrHit)+.0208);
  return {...row,k,bb,hr,babip,nonHrHit,out};
}
