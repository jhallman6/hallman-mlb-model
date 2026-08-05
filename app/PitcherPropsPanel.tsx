"use client";
import { useMemo, useState } from "react";
import distributions from "../data/pitcher-prop-distributions.json";

type MarketKey="SO"|"BB"|"ER"|"OUTS";
type MarketInput={line:string;overOdds:string;underOdds:string};
type Point={value:number;probability:number};
const configs:{key:MarketKey;label:string;short:string;defaultLine:string;defaultOver:string;defaultUnder:string;unitScale:number}[]=[
 {key:"SO",label:"Strikeouts",short:"K",defaultLine:"3.5",defaultOver:"110",defaultUnder:"115",unitScale:15},
 {key:"BB",label:"Walks",short:"BB",defaultLine:"1.5",defaultOver:"128",defaultUnder:"-160",unitScale:10},
 {key:"ER",label:"Earned runs",short:"ER",defaultLine:"2.5",defaultOver:"-109",defaultUnder:"100",unitScale:10},
 {key:"OUTS",label:"Pitching outs",short:"OUTS",defaultLine:"15.5",defaultOver:"106",defaultUnder:"120",unitScale:25},
];
const implied=(odds:number)=>odds>0?100/(odds+100):odds<0?-odds/(-odds+100):.5;
const american=(prob:number)=>prob<=0||prob>=1?null:prob>.5?-100*prob/(1-prob):100*(1-prob)/prob;
function tilt(base:Point[],target:number){let low=-10,high=10;const mean=(theta:number)=>{let z=0,total=0;for(const p of base){const w=p.probability*Math.exp(Math.max(-700,Math.min(700,theta*p.value)));z+=w;total+=w*p.value}return total/z};for(let i=0;i<100;i++){const mid=(low+high)/2;if(mean(mid)<target)low=mid;else high=mid}const theta=(low+high)/2,raw=base.map(p=>({...p,w:p.probability*Math.exp(Math.max(-700,Math.min(700,theta*p.value)))})),z=raw.reduce((s,p)=>s+p.w,0);return raw.map(p=>({value:p.value,probability:p.w/z}))}
const pct=(v:number)=>`${(v*100).toFixed(2)}%`;
const oddsText=(v:number|null)=>v==null?"—":`${v>0?"+":""}${Math.round(v)}`;

export default function PitcherPropsPanel({pitcher,projection}:{pitcher:string;projection:Record<MarketKey,number>}){
 const[inputs,setInputs]=useState<Record<MarketKey,MarketInput>>(()=>Object.fromEntries(configs.map(c=>[c.key,{line:c.defaultLine,overOdds:c.defaultOver,underOdds:c.defaultUnder}])) as Record<MarketKey,MarketInput>);
 const results=useMemo(()=>Object.fromEntries(configs.map(config=>{const input=inputs[config.key],line=Number(input.line),overOdds=Number(input.overOdds),underOdds=Number(input.underOdds),base=distributions.markets[config.key] as Point[],tilted=tilt(base,projection[config.key]),over=tilted.filter(p=>p.value>line).reduce((s,p)=>s+p.probability,0),under=1-over,overImp=implied(overOdds),underImp=implied(underOdds),overEdge=over-overImp,underEdge=under-underImp;return[config.key,{over,under,overImp,underImp,overEdge,underEdge,overFair:american(over),underFair:american(under),overUnits:overEdge>.0699?overEdge*8*(over*.8)*config.unitScale:0,underUnits:underEdge>.0699?underEdge*8*(under*.8)*config.unitScale:0}]})) as Record<MarketKey,{over:number;under:number;overImp:number;underImp:number;overEdge:number;underEdge:number;overFair:number|null;underFair:number|null;overUnits:number;underUnits:number}>,[inputs,projection]);
 const update=(key:MarketKey,field:keyof MarketInput,value:string)=>setInputs(current=>({...current,[key]:{...current[key],[field]:value}}));
 return <section className="props-panel"><div className="props-heading"><div><span>Pitcher prop model</span><h2>{pitcher}</h2><p>Empirical distributions · exponential tilt to the game projection · sportsbook inputs are manual</p></div><strong>{distributions.sampleSize.toLocaleString()} game sample</strong></div><div className="prop-grid">{configs.map(config=>{const input=inputs[config.key],r=results[config.key];return <article className="prop-card" key={config.key}><div className="prop-card-title"><div><span>{config.short}</span><h3>{config.label}</h3></div><strong>Proj {projection[config.key].toFixed(2)}</strong></div><div className="prop-input-row"><label>Line<input inputMode="decimal" value={input.line} onChange={e=>update(config.key,"line",e.target.value)}/></label><label>Over odds<input inputMode="numeric" value={input.overOdds} onChange={e=>update(config.key,"overOdds",e.target.value)}/></label><label>Under odds<input inputMode="numeric" value={input.underOdds} onChange={e=>update(config.key,"underOdds",e.target.value)}/></label></div><div className="prop-sides"><div className={r.overEdge>0?"positive":""}><span>Over</span><strong>{pct(r.over)}</strong><small>Fair {oddsText(r.overFair)} · Book {pct(r.overImp)}</small><b>Edge {pct(r.overEdge)}</b><em>{r.overUnits?`${r.overUnits.toFixed(2)} units`:"No play"}</em></div><div className={r.underEdge>0?"positive":""}><span>Under</span><strong>{pct(r.under)}</strong><small>Fair {oddsText(r.underFair)} · Book {pct(r.underImp)}</small><b>Edge {pct(r.underEdge)}</b><em>{r.underUnits?`${r.underUnits.toFixed(2)} units`:"No play"}</em></div></div></article>})}</div></section>
}
