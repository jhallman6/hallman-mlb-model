"use client";
import {useCallback,useMemo,useState} from "react";
import TeamProjectionPanel from "./TeamProjectionPanel";
import type {BestBet} from "./PitcherPropsPanel";

type Player={order:number;playerId:number;name:string;bats:string;position:string};
type Team={name:string;abbreviation:string;pitcher:string;pitcherId:number|null;throws:string;lineup:Player[];lineupStatus:string};
type Game={gamePk:number;started?:boolean;away:Team;home:Team};
type RankedBet=BestBet&{matchup:string};
const pct=(value:number)=>`${(value*100).toFixed(2)}%`;
const odds=(value:number)=>`${value>0?"+":""}${value}`;

function Calculator({id,game,side,unitSize,onUpdate}:{id:string;game:Game;side:"away"|"home";unitSize:number;onUpdate:(id:string,matchup:string,bets:BestBet[])=>void}){
 const team=game[side],opponent=game[side==="away"?"home":"away"],matchup=`${game.away.abbreviation} at ${game.home.abbreviation}`;
 const handle=useCallback((bets:BestBet[])=>onUpdate(id,matchup,bets),[id,matchup,onUpdate]);
 return <TeamProjectionPanel team={team} opponent={opponent} side={side} headless unitSizeOverride={unitSize} onBets={handle}/>;
}

export default function BestBets({games}:{games:Game[]}){
 const[unitInput,setUnitInput]=useState("100"),[groups,setGroups]=useState<Record<string,{matchup:string;bets:BestBet[]}>>({});
 const eligibleGames=useMemo(()=>games.filter(game=>!game.started),[games]);
 const eligibleIds=useMemo(()=>new Set(eligibleGames.flatMap(game=>[`${game.gamePk}-away`,`${game.gamePk}-home`])),[eligibleGames]);
 const unitSize=Math.max(0,Number(unitInput)||0);
 const update=useCallback((id:string,matchup:string,bets:BestBet[])=>setGroups(current=>current[id]?.matchup===matchup&&JSON.stringify(current[id].bets)===JSON.stringify(bets)?current:{...current,[id]:{matchup,bets}}),[]);
 const ranked=useMemo(()=>Object.entries(groups).filter(([id])=>eligibleIds.has(id)).flatMap(([,group])=>group.bets.map(bet=>({...bet,matchup:group.matchup} as RankedBet))).filter(bet=>bet.edge>=.07).sort((a,b)=>b.edge-a.edge),[groups,eligibleIds]);
 const expected=eligibleGames.length*2,loaded=Object.keys(groups).filter(id=>eligibleIds.has(id)).length;
 return <section className="best-bets-page"><div className="best-bets-hero"><div><p className="eyebrow">Slate-wide value board</p><h1>Best Bets</h1><p>Every available pregame pitcher prop with at least a 7% model edge, ranked from strongest to weakest. Games disappear once they begin.</p></div><div className="best-bets-unit"><label>Dollar unit size<input inputMode="decimal" value={unitInput} onChange={event=>setUnitInput(event.target.value)}/></label><small>{loaded}/{expected} pitchers evaluated</small></div></div><div className="best-bets-summary"><div><span>Qualified bets</span><strong>{ranked.length}</strong></div><div><span>Minimum edge</span><strong>7.00%</strong></div><div><span>Recommended exposure</span><strong>${ranked.reduce((sum,bet)=>sum+bet.amount,0).toFixed(2)}</strong></div></div>{loaded<expected&&<div className="best-bets-loading"><span>Calculating the full slate</span><strong>{Math.round(loaded/Math.max(1,expected)*100)}%</strong></div>}{loaded===expected&&!ranked.length?<div className="no-games"><strong>No pregame bets currently clear 7%.</strong><span>The board will update as sportsbook prices and game statuses change.</span></div>:<div className="best-bets-table"><table><thead><tr><th>Rank</th><th>Matchup</th><th>Pitcher</th><th>Bet</th><th>Best book</th><th>Odds</th><th>Model probability</th><th>Edge</th><th>Units</th><th>Recommended bet</th></tr></thead><tbody>{ranked.map((bet,index)=><tr key={`${bet.matchup}-${bet.id}`}><td><strong>#{index+1}</strong></td><td>{bet.matchup}</td><td className="player-name">{bet.pitcher}</td><td><strong>{bet.selection} {bet.line}</strong><small>{bet.market}{bet.alternate?" · alternate":""}</small></td><td>{bet.book}</td><td>{odds(bet.odds)}</td><td>{pct(bet.modelProbability)}</td><td className="positive-cell">{pct(bet.edge)}</td><td>{bet.units.toFixed(2)}</td><td><strong>${bet.amount.toFixed(2)}</strong></td></tr>)}</tbody></table></div>}<div className="best-bet-calculators" aria-hidden="true">{eligibleGames.flatMap(game=>(["away","home"] as const).map(side=><Calculator key={`${game.gamePk}-${side}`} id={`${game.gamePk}-${side}`} game={game} side={side} unitSize={unitSize} onUpdate={update}/>))}</div></section>;
}
