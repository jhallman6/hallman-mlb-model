import { NextRequest, NextResponse } from "next/server";
import fanGraphsLineups from "../../../data/fangraphs-lineups-2026-08-05.json";
export const dynamic = "force-dynamic";
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const FG_CHALLENGE = /performing security verification|just a moment|cf-chl/i;
const easternToday = () => new Intl.DateTimeFormat("en-CA", {timeZone:"America/New_York",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
const isoDate = (date: Date) => date.toISOString().slice(0, 10);
async function fetchJson(url:string){const response=await fetch(url,{headers:{Accept:"application/json","User-Agent":"Hallman-MLB-Model/1.0"},cache:"no-store"});if(!response.ok)throw new Error(`MLB data request failed (${response.status}).`);return response.json()}
async function checkFanGraphs(url:string){try{const response=await fetch(url,{headers:{Accept:"text/html","User-Agent":"Mozilla/5.0 (compatible; HallmanMLB/1.0)"},cache:"no-store",signal:AbortSignal.timeout(8000)});const text=await response.text();return response.ok&&!FG_CHALLENGE.test(text)?"available":"protected"}catch{return"unreachable"}}
function lineupFor(side:any,gameData:any){const players=side?.players||{};return(side?.battingOrder||[]).slice(0,9).map((id:number,index:number)=>{const player=players[`ID${id}`]||{},details=gameData?.players?.[`ID${id}`]||{};return{order:index+1,playerId:id,name:player.person?.fullName||details.fullName||"Unknown",bats:details.batSide?.code||"",position:player.position?.abbreviation||""}})}
function pitcherFor(game:any,side:"away"|"home"){const pitcher=game.gameData?.probablePitchers?.[side],details=pitcher?.id?game.gameData?.players?.[`ID${pitcher.id}`]:null;return{id:pitcher?.id||null,name:pitcher?.fullName||"TBD",throws:details?.pitchHand?.code||""}}
function teamSide(game:any,teamId:number){if(game?.gameData?.teams?.away?.id===teamId)return"away";if(game?.gameData?.teams?.home?.id===teamId)return"home";return null}
const teamNicknames=["bluejays","whitesox","redsox","diamondbacks","athletics","guardians","nationals","phillies","cardinals","yankees","dodgers","astros","cubs","giants","rangers","rays","rockies","angels","orioles","mets","reds","marlins","braves","twins","royals","pirates","brewers","tigers","mariners","padres"];
const normalizeTeam=(value:string)=>{const clean=value.toLowerCase().replace(/[^a-z]/g,"");return teamNicknames.find(name=>clean.includes(name))||clean};
function datedFanGraphsLineup(date:string,game:any,side:"away"|"home"){
  if(date!==fanGraphsLineups.date)return null;
  const target=normalizeTeam(game?.gameData?.teams?.[side]?.name||"");
  const team=fanGraphsLineups.games.flatMap(g=>g.teams).find(t=>normalizeTeam(t.name)===target);
  if(!team||team.players.length<9)return null;
  const mlbPlayers=Object.values(game?.gameData?.players||{}) as any[];
  return {status:team.status,players:team.players.map(player=>{const match=mlbPlayers.find(p=>String(p.fullName||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]/g,"")===player.name.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]/g,""));return{order:player.order,playerId:match?.id||0,name:player.name,bats:player.bats,position:player.position}})};
}

async function projectedLineups(date:string,currentFeeds:any[]){
  const missing=new Set<number>();
  for(const game of currentFeeds)for(const side of ["away","home"] as const){const teamId=game?.gameData?.teams?.[side]?.id;const current=lineupFor(game?.liveData?.boxscore?.teams?.[side],game?.gameData);if(teamId&&current.length<9)missing.add(teamId)}
  if(!missing.size)return new Map<number,any[]>();
  const selected=new Date(`${date}T12:00:00Z`),end=new Date(selected),start=new Date(selected);end.setUTCDate(end.getUTCDate()-1);start.setUTCDate(start.getUTCDate()-12);
  const history=await fetchJson(`https://statsapi.mlb.com/api/v1/schedule?sportId=1&startDate=${isoDate(start)}&endDate=${isoDate(end)}`);
  const previous=(history?.dates||[]).flatMap((day:any)=>day.games||[]).sort((a:any,b:any)=>String(b.gameDate).localeCompare(String(a.gameDate)));
  const gamesForTeam=new Map<number,number[]>();
  for(const game of previous)for(const side of ["away","home"] as const){const teamId=game?.teams?.[side]?.team?.id;if(!missing.has(teamId))continue;const candidates=gamesForTeam.get(teamId)||[];if(candidates.length<4){candidates.push(game.gamePk);gamesForTeam.set(teamId,candidates)}}
  const candidateGamePks=[...new Set([...gamesForTeam.values()].flat())];
  const priorFeeds=await Promise.all(candidateGamePks.map(gamePk=>fetchJson(`https://statsapi.mlb.com/api/v1.1/game/${gamePk}/feed/live`).catch(()=>null)));
  const feedByPk=new Map(priorFeeds.filter(Boolean).map((feed:any)=>[feed.gamePk,feed]));const projections=new Map<number,any[]>();
  for(const[teamId,gamePks]of gamesForTeam)for(const gamePk of gamePks){const feed:any=feedByPk.get(gamePk),side=teamSide(feed,teamId);if(!side)continue;const lineup=lineupFor(feed?.liveData?.boxscore?.teams?.[side],feed?.gameData);if(lineup.length>=9){projections.set(teamId,lineup);break}}
  return projections;
}

export async function GET(request:NextRequest){
  const date=request.nextUrl.searchParams.get("date")||easternToday();if(!DATE_PATTERN.test(date)||Number.isNaN(Date.parse(`${date}T12:00:00Z`)))return NextResponse.json({error:"Use a valid date in YYYY-MM-DD format."},{status:400});
  const sourceUrl=`https://www.fangraphs.com/scores?date=${date}`;
  try{
    const[fanGraphsStatus,schedule]=await Promise.all([checkFanGraphs(sourceUrl),fetchJson(`https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${date}`)]);const scheduled=schedule?.dates?.[0]?.games||[];
    const feeds=(await Promise.all(scheduled.map((g:any)=>fetchJson(`https://statsapi.mlb.com/api/v1.1/game/${g.gamePk}/feed/live`).catch(()=>null)))).filter(Boolean);const projections=await projectedLineups(date,feeds);
    const games=feeds.map((game:any)=>{const ap=pitcherFor(game,"away"),hp=pitcherFor(game,"home"),awayId=game.gameData?.teams?.away?.id,homeId=game.gameData?.teams?.home?.id,confirmedAway=lineupFor(game.liveData?.boxscore?.teams?.away,game.gameData),confirmedHome=lineupFor(game.liveData?.boxscore?.teams?.home,game.gameData),fgAway=datedFanGraphsLineup(date,game,"away"),fgHome=datedFanGraphsLineup(date,game,"home"),awayLineup=confirmedAway.length>=9?confirmedAway:fgAway?.players||projections.get(awayId)||[],homeLineup=confirmedHome.length>=9?confirmedHome:fgHome?.players||projections.get(homeId)||[],firstPitch=new Date(game.gameData?.datetime?.dateTime);return{gamePk:game.gamePk,gameTime:Number.isNaN(firstPitch.getTime())?"TBD":firstPitch.toLocaleTimeString("en-US",{timeZone:"America/New_York",hour:"numeric",minute:"2-digit"})+" ET",venue:game.gameData?.venue?.name||"Venue TBD",status:game.gameData?.status?.detailedState||"Scheduled",away:{name:game.gameData?.teams?.away?.name||"Away",abbreviation:game.gameData?.teams?.away?.abbreviation||"AWY",pitcher:ap.name,pitcherId:ap.id,throws:ap.throws,lineup:awayLineup,lineupStatus:confirmedAway.length>=9?"Confirmed lineup":fgAway?.status||awayLineup.length?"Projected lineup":"Projection unavailable"},home:{name:game.gameData?.teams?.home?.name||"Home",abbreviation:game.gameData?.teams?.home?.abbreviation||"HME",pitcher:hp.name,pitcherId:hp.id,throws:hp.throws,lineup:homeLineup,lineupStatus:confirmedHome.length>=9?"Confirmed lineup":fgHome?.status||homeLineup.length?"Projected lineup":"Projection unavailable"}}});
    return NextResponse.json({date,fetchedAt:new Date().toISOString(),sourceUrl,fanGraphsStatus,source:date===fanGraphsLineups.date?"FanGraphs dated lineups + MLB live feed":"MLB live feed fallback",warning:"Confirmed MLB lineups replace FanGraphs projections automatically. Unconfirmed hitters use the FanGraphs lineup for the selected date.",games},{headers:{"Cache-Control":"no-store, max-age=0"}})
  }catch(error){return NextResponse.json({error:error instanceof Error?error.message:"The lineup feed is unavailable."},{status:502})}
}
