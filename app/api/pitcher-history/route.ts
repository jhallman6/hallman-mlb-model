import { NextRequest, NextResponse } from "next/server";

type GameLogSplit={date?:string;opponent?:{name?:string};isHome?:boolean;stat?:{gamesStarted?:number;numberOfPitches?:number;pitchesThrown?:number}};

export async function GET(request:NextRequest){
 const playerId=Number(request.nextUrl.searchParams.get("playerId"));
 if(!Number.isFinite(playerId)||playerId<=0)return NextResponse.json({error:"A valid pitcher ID is required."},{status:400});
 try{
  const url=`https://statsapi.mlb.com/api/v1/people/${playerId}/stats?stats=gameLog&group=pitching&season=2026&gameType=R`;
  const response=await fetch(url,{cache:"no-store"});
  if(!response.ok)throw new Error(`MLB game logs returned ${response.status}`);
  const body=await response.json() as {stats?:{splits?:GameLogSplit[]}[]};
  const starts=(body.stats?.[0]?.splits||[]).filter(split=>(split.stat?.gamesStarted||0)>0&&Number.isFinite(Number(split.stat?.numberOfPitches??split.stat?.pitchesThrown))).sort((a,b)=>String(b.date||"").localeCompare(String(a.date||""))).slice(0,10).map(split=>({date:split.date||"",opponent:split.opponent?.name||"",location:split.isHome?"vs":"at",pitches:Number(split.stat?.numberOfPitches??split.stat?.pitchesThrown)}));
  const average=starts.length?starts.reduce((sum,start)=>sum+start.pitches,0)/starts.length:null;
  return NextResponse.json({playerId,season:2026,starts,average,fetchedAt:new Date().toISOString()});
 }catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Pitcher history could not be loaded."},{status:502})}
}
