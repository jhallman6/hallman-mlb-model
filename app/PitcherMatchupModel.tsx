import battedBall from "../data/fangraphs-pitcher-batted-ball-2026.json";
import standard from "../data/fangraphs-pitcher-standard-2026.json";
import statcast from "../data/fangraphs-pitcher-statcast-2026.json";
import locationPlus from "../data/fangraphs-pitcher-location-plus-2026.json";
import savant from "../data/baseball-savant-pitcher-results-2026.json";
import zips from "../data/fangraphs-zips-update-pitching-2026.json";

type Team = { name:string; abbreviation:string; pitcher:string; pitcherId:number|null; throws:string };
const normalize = (value:string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/\b(rhp|lhp|jr|sr|ii|iii|iv)\b/g,"").replace(/[^a-z0-9]/g,"");
const variants = (value:string) => { const clean=value.replace(/\b(RHP|LHP)\b/gi,"").trim(), parts=clean.split(",").map(v=>v.trim()); return new Set([normalize(clean),parts.length===2?normalize(`${parts[1]} ${parts[0]}`):normalize(clean)]); };
const rowByName = (rows:string[][], name:string) => { const names=variants(name); return rows.find(row=>names.has(normalize(row[1]||""))); };
const n = (value:unknown) => { const parsed=Number(String(value??"").replace(/[%,$]/g,"")); return Number.isFinite(parsed)?parsed:null; };
const rate = (value:unknown) => { const raw=String(value??""), valueNumber=n(value); return valueNumber==null?null:raw.includes("%")?valueNumber/100:valueNumber; };
const cell = (headers:string[], row:string[]|undefined, label:string) => row?n(row[headers.indexOf(label)]):null;
const pctCell = (headers:string[], row:string[]|undefined, label:string) => row?rate(row[headers.indexOf(label)]):null;
const fmtPct = (value:number|null, digits=2) => value==null?"—":`${(value*100).toFixed(digits)}%`;
const fmt = (value:number|null, digits=2) => value==null?"—":value.toFixed(digits);

function calculate(team:Team){
  const bb=rowByName(battedBall.rows,team.pitcher), st=rowByName(standard.rows,team.pitcher), sc=rowByName(statcast.rows,team.pitcher), loc=rowByName(locationPlus.rows,team.pitcher), zp=rowByName(zips.rows.map(row=>row.values),team.pitcher);
  const sv=savant.rows.find(row=>row.playerId===team.pitcherId)||savant.rows.find(row=>variants(row.player).has(normalize(team.pitcher)));
  const strikes=cell(battedBall.headers,bb,"Strikes"), pitches=cell(battedBall.headers,bb,"Pitches"), balls=cell(battedBall.headers,bb,"Balls"), pa=cell(standard.headers,st,"TBF");
  const swingK=strikes&&sv?sv.totalSwingingStrikes/strikes:null, calledK=strikes&&sv?sv.calledStrikes/strikes:null, foulK=strikes&&sv?sv.foulStrikes/strikes:null, threeOh=pa&&sv?sv.threeOhPitches/pa:null, pitchPa=pa&&pitches?pitches/pa:null;
  const location=cell(locationPlus.headers,loc,"Location+"), ballPct=balls&&pitches?balls/pitches:null, la=cell(statcast.headers,sc,"LA"), ev=cell(statcast.headers,sc,"EV"), gb=pctCell(battedBall.headers,bb,"GB%"), fb=pctCell(battedBall.headers,bb,"FB%"), pullAir=sv?.pullAirPct==null?null:sv.pullAirPct/100;
  const required=[swingK,calledK,foulK,threeOh,pitchPa,location,ballPct,la,ev,gb,fb,pullAir]; if(required.some(v=>v==null))return null;
  const xK=-.6679895263807183+1.8733253169611035*swingK!+1.6890512430057771*calledK!+1.459294157015805*foulK!-.22910112819665532*threeOh!-.07356372778974428*pitchPa!;
  const xBB=-.048039043088303035-.00141879865032413*location!+.5228010849511373*ballPct!+.02123599222990451*pitchPa!;
  const xHrBbe=-.2590728091893069+.0008074147711774937*la!+.11188689382702152*pullAir!+.0030989882500865617*ev!;
  const xBabip=.3989271504103161-.5297101107247907*gb!-.656879479252608*fb!+.004058819610718729*ev!;
  const hrPa=(1-(xK+xBB+.01))*xHrBbe, xLob=.9270535932438255-.817851367028513*xBabip-.5992734442095049*hrPa+.33298614715087343*xK-.15778625258462137*xBB;
  const xTbf=3.416402833964028-1.1557821686027048*xK+4.102546182595185*xBB+3.311095449848003*xBabip+4.604786990811972*hrPa-.15345532064205641*gb!-.3968258802750537*xLob;
  const per9=xTbf*9, k9=xK*per9, bb9=xBB*per9, hr9=hrPa*per9;
  const xIp=8.294525150562876-.6151693253617958*xTbf-.005394002571073699*k9-.08995171725085663*bb9-.06997056464819301*hr9+.5432484070990715*gb!-1.3730658930181903*xBabip+.4865623229561087*xLob;
  const xEra=6.38962212351265-.08464162401482268*k9+.24020891024268287*bb9+1.376527622794622*hr9+8.835440448633044*xBabip-8.816991425593324*xLob;
  return {summary:[["xK%",fmtPct(xK)],["xBB%",fmtPct(xBB)],["xHR/BBE",fmtPct(xHrBbe)],["xBABIP",fmt(xBabip,3)],["xTBF/INN",fmt(xTbf)],["xLOB%",fmtPct(xLob)],["xIP",fmt(xIp)],["xERA",fmt(xEra)]],per9:[["K/9",fmt(k9)],["BB/9",fmt(bb9)],["HR/9",fmt(hr9)]],drivers:[["Swing K",fmtPct(swingK)],["Called K",fmtPct(calledK)],["Foul strike",fmtPct(foulK)],["Strikes",strikes!.toLocaleString()],["PA",pa!.toLocaleString()],["3–0%",fmtPct(threeOh)],["Pitch/PA",fmt(pitchPa)],["Location+",fmt(location!,0)],["Ball%",fmtPct(ballPct)],["LA",fmt(la!,1)],["Pull AIR%",fmtPct(pullAir)],["EV",fmt(ev!,1)],["GB%",fmtPct(gb)],["FB%",fmtPct(fb)]],zips:zp?[["IP",zp[8]],["K/9",zp[9]],["BB/9",zp[10]],["HR/9",zp[11]],["BABIP",zp[12]],["LOB%",zp[13]],["GB%",zp[14]],["ERA",zp[15]]]:[]};
}

function PitcherCard({team,side}:{team:Team;side:string}){const model=calculate(team);return <section className="pitcher-model-card"><div className="pitcher-model-heading"><div><span>{side} pitcher</span><h3>{team.pitcher}</h3></div><strong>{team.throws||"—"}HP</strong></div>{!model?<div className="pitcher-model-empty">The 2026 source tables do not yet contain every input needed for this pitcher.</div>:<><div className="pitcher-kpis">{model.summary.map(([label,value])=><div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div><div className="pitcher-detail-grid"><div><h4>Per 9</h4>{model.per9.map(([label,value])=><p key={label}><span>{label}</span><strong>{value}</strong></p>)}</div><div><h4>Model inputs</h4>{model.drivers.map(([label,value])=><p key={label}><span>{label}</span><strong>{value}</strong></p>)}</div><div><h4>ZiPS (Update)</h4>{model.zips.map(([label,value])=><p key={label}><span>{label}</span><strong>{value}</strong></p>)}</div></div></>}</section>}
export default function PitcherMatchupModel({away,home}:{away:Team;home:Team}){return <div className="pitcher-model-matchup"><PitcherCard team={away} side="Away"/><PitcherCard team={home} side="Home"/></div>}
