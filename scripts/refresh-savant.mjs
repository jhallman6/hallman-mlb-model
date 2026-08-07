import fs from "node:fs/promises";
import path from "node:path";

const DATA = path.resolve("data");
const season = 2026;
function parseCsv(text) { const out=[]; let row=[],field="",q=false; for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(q&&text[i+1]==='"'){field+='"';i++;}else q=!q;}else if(c===','&&!q){row.push(field);field="";}else if((c==='\n'||c==='\r')&&!q){if(c==='\r'&&text[i+1]==='\n')i++;row.push(field);if(row.some(Boolean))out.push(row);row=[];field="";}else field+=c;} if(field||row.length){row.push(field);out.push(row);} const headers=out.shift()??[]; return out.map(values=>Object.fromEntries(headers.map((h,i)=>[h,values[i]??""]))); }
async function csv(url){const r=await fetch(url,{headers:{Accept:"text/csv","User-Agent":"Hallman-MLB-Model/1.0"}});if(!r.ok)throw new Error(`${url} returned ${r.status}`);const rows=parseCsv(await r.text());if(!rows.length)throw new Error(`${url} returned no rows`);return rows;}
const number=v=>v===""||v==null?null:Number(v);
const csvUrl=url=>url.replace("/statcast_search?","/statcast_search/csv?").replace(/#results$/,'');
async function atomic(name,value){const target=path.join(DATA,name),temp=`${target}.${process.pid}.new`;await fs.writeFile(temp,JSON.stringify(value,null,2)+"\n");await fs.rename(temp,target);}

const hitterName="baseball-savant-hitter-pitches-bb-2026.json";
const hitterOld=JSON.parse(await fs.readFile(path.join(DATA,hitterName),"utf8"));
const hitterQueries={base:hitterOld.sourceUrl,strikes:hitterOld.strikesSourceUrl,swing:hitterOld.swingingStrikesSourceUrl,called:hitterOld.calledStrikesSourceUrl,foul:hitterOld.foulStrikesSourceUrl,three:hitterOld.threeOhPitchesSourceUrl};
const hitterData=Object.fromEntries(await Promise.all(Object.entries(hitterQueries).map(async([k,u])=>[k,await csv(csvUrl(u))])));
const hitterMaps=Object.fromEntries(Object.entries(hitterData).map(([k,rows])=>[k,new Map(rows.map(r=>[Number(r.player_id),r]))]));
const hitterRows=hitterData.base.map((r,i)=>{const id=Number(r.player_id);return{playerId:id,rank:i+1,player:r.player_name,pitches:number(r.pitches),pa:number(r.pa),bbPct:number(r.bb_percent),totalStrikes:number(hitterMaps.strikes.get(id)?.pitches)??0,totalSwingingStrikes:number(hitterMaps.swing.get(id)?.pitches)??0,calledStrikes:number(hitterMaps.called.get(id)?.pitches)??0,foulStrikes:number(hitterMaps.foul.get(id)?.pitches)??0,threeOhPitches:number(hitterMaps.three.get(id)?.pitches)??0};});
for(const row of hitterRows){for(const key of ['totalStrikes','totalSwingingStrikes','calledStrikes','foulStrikes','threeOhPitches'])if(row[key]<0||row[key]>row.pitches)throw new Error(`${hitterName}: invalid ${key} for ${row.player}`);for(const key of ['totalSwingingStrikes','calledStrikes','foulStrikes'])if(row[key]>row.totalStrikes)throw new Error(`${hitterName}: ${key} exceeds total strikes for ${row.player}`);}
await atomic(hitterName,{...hitterOld,season,fetchedAt:new Date().toISOString(),rows:hitterRows});
console.log(`Validated ${hitterName}: ${hitterRows.length}`);

const pitcherName="baseball-savant-pitcher-results-2026.json";
const pitcherOld=JSON.parse(await fs.readFile(path.join(DATA,pitcherName),"utf8"));
const pitcherQueries={base:pitcherOld.sourceUrls.base,swing:pitcherOld.sourceUrls.totalSwingingStrikes,called:pitcherOld.sourceUrls.calledStrikes,foul:pitcherOld.sourceUrls.foulStrikes,three:pitcherOld.sourceUrls.threeOhPitches};
const pitcherData=Object.fromEntries(await Promise.all(Object.entries(pitcherQueries).map(async([k,u])=>[k,await csv(csvUrl(u))])));
const pitcherMaps=Object.fromEntries(Object.entries(pitcherData).map(([k,rows])=>[k,new Map(rows.map(r=>[Number(r.player_id),r]))]));
const pullUrl=`https://baseballsavant.mlb.com/leaderboard/batted-ball?type=pitcher&season%5B%5D=${season}&splitYear=1&min=1&minSplit=1&gameType%5B%5D=R&csv=true`;
const pullRows=await csv(pullUrl),pullMap=new Map(pullRows.map(r=>[Number(r.id),r]));
const pitcherRows=pitcherData.base.map((r,i)=>{const id=Number(r.player_id);return{playerId:id,rank:i+1,player:r.player_name,totalPitches:number(r.pitches),totalSwingingStrikes:number(pitcherMaps.swing.get(id)?.pitches)??0,calledStrikes:number(pitcherMaps.called.get(id)?.pitches)??0,foulStrikes:number(pitcherMaps.foul.get(id)?.pitches)??0,threeOhPitches:number(pitcherMaps.three.get(id)?.pitches)??0,pullAirPct:(number(pullMap.get(id)?.pull_air_rate)??0)*100};});
for(const row of pitcherRows){for(const key of ['totalSwingingStrikes','calledStrikes','foulStrikes','threeOhPitches'])if(row[key]<0||row[key]>row.totalPitches)throw new Error(`${pitcherName}: invalid ${key} for ${row.player}`);if(row.pullAirPct<0||row.pullAirPct>100)throw new Error(`${pitcherName}: invalid pullAirPct for ${row.player}`);}
await atomic(pitcherName,{...pitcherOld,season,fetchedAt:new Date().toISOString(),pullAirSourceUrl:pullUrl,rows:pitcherRows});
console.log(`Validated ${pitcherName}: ${pitcherRows.length}`);
