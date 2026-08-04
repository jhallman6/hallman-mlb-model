"use client";
import { useMemo, useState } from "react";
import standard from "../data/fangraphs-pitcher-standard-2026.json";
import battedBall from "../data/fangraphs-pitcher-batted-ball-2026.json";
import statcast from "../data/fangraphs-pitcher-statcast-2026.json";
import locationPlus from "../data/fangraphs-pitcher-location-plus-2026.json";

type FanGraphsTable={season:number;minimum:number;source:string;headers:string[];rows:string[][]};
const tables:[string,FanGraphsTable][]=[["Standard",standard],["Batted Ball",battedBall],["Statcast",statcast],["Location+",locationPlus]];

function PitcherTable({title,data,query}:{title:string;data:FanGraphsTable;query:string}){
  const visibleColumns=data.headers.map((label,index)=>({label,index})).filter(({label})=>label!=="-- Line Break --");
  const rows=useMemo(()=>{const q=query.trim().toLowerCase();return q?data.rows.filter(row=>`${row[1]} ${row[2]}`.toLowerCase().includes(q)):data.rows},[data.rows,query]);
  return <section className="stat-table-card"><div className="table-title"><div><p>FanGraphs pitcher table</p><h2>{title}</h2></div><span>{rows.length} pitchers</span></div><div className="table-scroll"><table><thead><tr>{visibleColumns.map(({label,index})=><th key={`${label}-${index}`}>{label}</th>)}</tr></thead><tbody>{rows.map((row,rowIndex)=><tr key={`${row[1]}-${rowIndex}`}>{visibleColumns.map(({index,label})=><td className={label==="Name"?"player-name":""} key={index}>{row[index]||"—"}</td>)}</tr>)}</tbody></table></div></section>;
}

export default function PitcherData(){const[query,setQuery]=useState("");return <><section className="stats-hero"><div><p className="eyebrow">PITCHER DATA</p><h1>Every arm,<br/><em>ready for the model.</em></h1><p className="hero-copy">Authenticated 2026 FanGraphs Standard, Batted Ball, Statcast, and Location+ data, with the minimum set to 1.</p></div><div className="stat-controls"><label htmlFor="pitcher-search">Find a pitcher or team</label><input id="pitcher-search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Paul Skenes or PIT"/><div><span>Season</span><strong>2026</strong></div><div><span>Scheduled update</span><strong>9:00 AM ET daily</strong></div></div></section><div className="stat-tables">{tables.map(([title,data])=><PitcherTable key={title} title={title} data={data} query={query}/>)}</div><footer>Source: FanGraphs · 2026 season · Minimum playing time 1 · <a href={standard.source} target="_blank" rel="noreferrer">Open pitcher leaderboards</a></footer></>}
