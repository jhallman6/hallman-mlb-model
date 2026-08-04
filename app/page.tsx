"use client";
import { useCallback, useEffect, useMemo, useState } from "react";

type Player = { order:number; name:string; bats:string; position:string };
type Team = { name:string; abbreviation:string; pitcher:string; throws:string; lineup:Player[]; lineupStatus:string };
type Game = { gamePk:number; gameTime:string; venue:string; status:string; away:Team; home:Team };
type Payload = { date:string; fetchedAt:string; source:string; sourceUrl:string; fanGraphsStatus:string; games:Game[]; warning?:string };

const easternToday = () => new Intl.DateTimeFormat("en-CA", { timeZone:"America/New_York", year:"numeric", month:"2-digit", day:"2-digit" }).format(new Date());

function Lineup({ team }: { team:Team }) {
  const confirmed = team.lineupStatus === "Confirmed lineup";
  return <section className="team-panel">
    <div className="team-heading"><div><span className="team-code">{team.abbreviation}</span><h3>{team.name}</h3></div><span className={`status-pill ${confirmed ? "posted" : "waiting"}`}>{team.lineupStatus}</span></div>
    <div className="pitcher-row"><span>SP</span><strong>{team.pitcher || "TBD"}</strong>{team.throws && <small>{team.throws}HP</small>}</div>
    {team.lineup.length ? <ol className="lineup-list">{team.lineup.map(player => <li key={`${team.abbreviation}-${player.order}-${player.name}`}><span className="order">{player.order}</span><strong>{player.name}</strong><span className="player-meta">{player.bats || "—"} · {player.position || "—"}</span></li>)}</ol> : <div className="empty-lineup">A recent lineup is not available for this team yet.</div>}
  </section>;
}

export default function Home() {
  const [date,setDate] = useState(easternToday);
  const [data,setData] = useState<Payload|null>(null);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState("");
  const loadLineups = useCallback(async (selectedDate:string) => {
    setLoading(true); setError("");
    try { const response=await fetch(`/api/lineups?date=${encodeURIComponent(selectedDate)}`,{cache:"no-store"}); const payload=await response.json() as Payload&{error?:string}; if(!response.ok)throw new Error(payload.error||"Lineups could not be loaded."); setData(payload); }
    catch(caught){setError(caught instanceof Error?caught.message:"Lineups could not be loaded.")}
    finally{setLoading(false)}
  },[]);
  useEffect(()=>{void loadLineups(date)},[date,loadLineups]);
  const gameCount=data?.games.length??0;
  const confirmedCount=useMemo(()=>data?.games.reduce((n,g)=>n+Number(g.away.lineupStatus==="Confirmed lineup")+Number(g.home.lineupStatus==="Confirmed lineup"),0)??0,[data]);
  return <main><header className="topbar"><div className="brand-mark">H</div><div><strong>The Hallman Algo</strong><span>MLB Game Model</span></div><a href="https://www.fangraphs.com/scores" target="_blank" rel="noreferrer">Open FanGraphs ↗</a></header><div className="page-shell">
    <section className="hero"><div><p className="eyebrow">Daily lineup command center</p><h1>Today’s slate,<br/><em>ready for the model.</em></h1><p className="hero-copy">Every matchup loads with a projected batting order. As teams announce their official lineups, refresh to replace projections automatically.</p></div><div className="date-card"><label htmlFor="slate-date">Slate date</label><input id="slate-date" type="date" value={date} onChange={e=>setDate(e.target.value)}/><button onClick={()=>void loadLineups(date)} disabled={loading}>{loading?"Refreshing…":"Refresh lineups"}</button><button className="today-button" onClick={()=>setDate(easternToday())}>Jump to today</button></div></section>
    <section className="summary-bar" aria-live="polite"><div><span>Games</span><strong>{loading?"—":gameCount}</strong></div><div><span>Confirmed lineups</span><strong>{loading?"—":`${confirmedCount}/${gameCount*2}`}</strong></div><div><span>Active source</span><strong>{data?.source||"Checking…"}</strong></div><div><span>FanGraphs</span><strong className={data?.fanGraphsStatus==="available"?"good":"warn"}>{data?.fanGraphsStatus||"Checking…"}</strong></div></section>
    {data?.warning&&<div className="notice"><strong>Lineup status</strong><span>{data.warning}</span></div>}{error&&<div className="error"><strong>Couldn’t load this slate.</strong><span>{error}</span><button onClick={()=>void loadLineups(date)}>Try again</button></div>}
    {loading?<div className="loading-grid">{Array.from({length:4}).map((_,i)=><div className="loading-card" key={i}/>)}</div>:data?.games.length?<div className="games-grid">{data.games.map(game=><article className="game-card" key={game.gamePk}><div className="game-meta"><div><span>{game.status}</span><strong>{game.gameTime}</strong></div><small>{game.venue}</small></div><div className="matchup"><Lineup team={game.away}/><div className="at">AT</div><Lineup team={game.home}/></div></article>)}</div>:!error&&<div className="no-games"><strong>No MLB games found.</strong><span>Choose another date to load a slate.</span></div>}
    {data&&<footer>Last checked {new Date(data.fetchedAt).toLocaleString("en-US",{timeZone:"America/New_York"})} ET · <a href={data.sourceUrl} target="_blank" rel="noreferrer">View dated FanGraphs page</a></footer>}
  </div></main>;
}
