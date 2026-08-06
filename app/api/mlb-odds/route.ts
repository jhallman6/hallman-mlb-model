import { NextRequest, NextResponse } from "next/server";

type Outcome={name:string;description?:string;price:number;point?:number};
type OddsEvent={id:string;away_team:string;home_team:string;bookmakers?:{key:string;title:string;markets:{key:string;outcomes:Outcome[]}[]}[]};
type Quote={market:string;player:string;side:string;line:number;odds:number;book:string};
const books="fanduel,draftkings,betmgm,kalshi,novig";
const markets="pitcher_strikeouts,pitcher_walks,pitcher_earned_runs,pitcher_hits_allowed,pitcher_outs,pitcher_strikeouts_alternate";
const labels:Record<string,string>={pitcher_strikeouts:"SO",pitcher_walks:"BB",pitcher_earned_runs:"ER",pitcher_hits_allowed:"HITS",pitcher_outs:"OUTS"};
const normalize=(value:string)=>value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/\b(rhp|lhp|jr|sr|ii|iii|iv)\b/g,"").replace(/[^a-z0-9]/g,"");
const cache=new Map<string,{expires:number,event:OddsEvent}>();
const pending=new Map<string,Promise<OddsEvent|null>>();
const failures=new Map<string,{expires:number;message:string}>();
const EVENT_CACHE_MS=30*60*1000;
const sameTeam=(a:string,b:string)=>{const x=normalize(a),y=normalize(b);return x===y||x.endsWith(y)||y.endsWith(x)};
const best=(quotes:Quote[],side:string)=>quotes.filter(q=>q.side===side).sort((a,b)=>b.odds-a.odds)[0];
function mainMarket(quotes:Quote[]){
 const counts=new Map<number,Set<string>>();for(const quote of quotes){if(!counts.has(quote.line))counts.set(quote.line,new Set());counts.get(quote.line)!.add(quote.book)}
 const line=[...counts.entries()].sort((a,b)=>b[1].size-a[1].size||a[0]-b[0])[0]?.[0];if(line==null)return null;
 const atLine=quotes.filter(q=>q.line===line),over=best(atLine,"Over"),under=best(atLine,"Under");
 return {line,overOdds:over?.odds??null,underOdds:under?.odds??null,overBook:over?.book??null,underBook:under?.book??null};
}
async function loadEvent(eventKey:string,away:string,home:string,apiKey:string){
 const cached=cache.get(eventKey);if(cached&&cached.expires>Date.now())return cached.event;
 const failed=failures.get(eventKey);if(failed&&failed.expires>Date.now())throw new Error(failed.message);
 const existing=pending.get(eventKey);if(existing)return existing;
 const request=(async()=>{const eventResponse=await fetch(`https://api.the-odds-api.com/v4/sports/baseball_mlb/events?apiKey=${encodeURIComponent(apiKey)}`,{cache:"no-store"});if(!eventResponse.ok)throw new Error(`Odds events returned ${eventResponse.status}`);const events=await eventResponse.json() as OddsEvent[],match=events.find(event=>sameTeam(event.away_team,away)&&sameTeam(event.home_team,home));if(!match)return null;const oddsResponse=await fetch(`https://api.the-odds-api.com/v4/sports/baseball_mlb/events/${match.id}/odds?apiKey=${encodeURIComponent(apiKey)}&bookmakers=${books}&markets=${markets}&oddsFormat=american`,{cache:"no-store"});if(!oddsResponse.ok)throw new Error(`MLB prop odds returned ${oddsResponse.status}`);const event=await oddsResponse.json() as OddsEvent;failures.delete(eventKey);cache.set(eventKey,{expires:Date.now()+EVENT_CACHE_MS,event});return event})().catch(error=>{const message=error instanceof Error?error.message:"MLB odds could not be loaded.";failures.set(eventKey,{expires:Date.now()+5*60*1000,message});throw error}).finally(()=>pending.delete(eventKey));pending.set(eventKey,request);return request;
}

export async function GET(request:NextRequest){
 const apiKey=process.env.THE_ODDS_API_KEY,away=request.nextUrl.searchParams.get("away")||"",home=request.nextUrl.searchParams.get("home")||"",pitcher=request.nextUrl.searchParams.get("pitcher")||"";
 if(!apiKey)return NextResponse.json({error:"The Odds API is not configured."},{status:503});
 if(!away||!home||!pitcher)return NextResponse.json({error:"Away team, home team, and pitcher are required."},{status:400});
 try{
  const eventKey=`${normalize(away)}-${normalize(home)}`,event=await loadEvent(eventKey,away,home,apiKey);
  if(!event)return NextResponse.json({event:null,markets:{},alternateStrikeouts:[],warning:"No matching sportsbook event is available yet."});
  const quotes:Quote[]=[];for(const bookmaker of event.bookmakers||[])for(const market of bookmaker.markets||[])for(const outcome of market.outcomes||[]){if(outcome.description&&Number.isFinite(outcome.point)&&Number.isFinite(outcome.price))quotes.push({market:market.key,player:outcome.description,side:outcome.name,line:Number(outcome.point),odds:Number(outcome.price),book:bookmaker.title})}
  const playerQuotes=quotes.filter(quote=>{const a=normalize(quote.player),b=normalize(pitcher);return a===b||a.includes(b)||b.includes(a)}),result:Record<string,ReturnType<typeof mainMarket>>={};
  for(const [market,key] of Object.entries(labels))result[key]=mainMarket(playerQuotes.filter(q=>q.market===market));
  const altLines=[...new Set(playerQuotes.filter(q=>q.market==="pitcher_strikeouts_alternate").map(q=>q.line))].sort((a,b)=>a-b).map(line=>{const quote=best(playerQuotes.filter(q=>q.market==="pitcher_strikeouts_alternate"&&q.line===line),"Over");return {line,overOdds:quote?.odds??null,book:quote?.book??null}}).filter(row=>row.overOdds!=null);
  return NextResponse.json({event:{away:event.away_team,home:event.home_team},pitcher,markets:result,alternateStrikeouts:altLines,fetchedAt:new Date().toISOString(),region:"New Jersey",books:["FanDuel","DraftKings","BetMGM","Kalshi","Novig"]},{headers:{"Cache-Control":"private, max-age=600"}});
 }catch(error){return NextResponse.json({error:error instanceof Error?error.message:"MLB odds could not be loaded."},{status:502,headers:{"Cache-Control":"private, max-age=60","Retry-After":"300"}})}
}
