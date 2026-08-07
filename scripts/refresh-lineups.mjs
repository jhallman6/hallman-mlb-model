import { chromium } from "playwright-core";
import fs from "node:fs/promises";
import path from "node:path";

const root=process.cwd(),profile=path.resolve(".refresh-state/fangraphs-profile"),edge="C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const date=new Intl.DateTimeFormat("en-CA",{timeZone:"America/New_York",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
const source=`https://www.fangraphs.com/scores?date=${date}`;
const context=await chromium.launchPersistentContext(profile,{executablePath:edge,headless:false});
let games;
try{
 const page=context.pages()[0]??await context.newPage();
 await page.goto(source,{waitUntil:"domcontentloaded",timeout:60000});
 await page.locator('div[class^="lineups_lineups"]').first().waitFor({state:"visible",timeout:60000});
 games=await page.locator('div[class^="lineups_lineups"]').evaluateAll(cards=>cards.map(card=>({teams:[...card.querySelectorAll('div[class^="lineups_teamSection"]')].slice(0,2).map(team=>{
  const header=team.querySelector('h3[class^="lineups_teamHeader"]');
  const odds=header?.querySelector('span'); odds?.remove();
  const sourceText=team.querySelector('div[class^="lineups_lineupSourceBox"]')?.textContent?.trim()??"Projected lineup";
  const players=[...team.querySelectorAll('li[class^="lineups_playerRow"]')].map((row,index)=>{
   const link=row.querySelector('a[href*="/players/"][href*="/stats/batting"]');
   const href=link?.getAttribute('href')??"";
   return{order:index+1,name:link?.textContent?.trim()??"",fangraphsId:Number(href.match(/\/players\/[^/]+\/(\d+)/)?.[1])||null,bats:row.querySelector('span[class^="lineups_batPill"]')?.textContent?.trim()??"",position:row.querySelector('span[class^="lineups_playerPos"]')?.textContent?.trim()??""};
  }).filter(player=>player.name);
  return{name:header?.textContent?.trim()??"",status:/confirmed/i.test(sourceText)?"Confirmed lineup":"Projected lineup",players};
 })})).filter(game=>game.teams.length===2&&game.teams.every(team=>team.name&&team.players.length===9)));
}finally{await context.close();}
if(!games?.length)throw new Error(`No complete FanGraphs lineups found for ${date}`);
const value={date,games,fetchedAt:new Date().toISOString(),source};
for(const name of ["fangraphs-lineups-current.json",`fangraphs-lineups-${date}.json`]){const target=path.join(root,"data",name),temp=`${target}.${process.pid}.new`;await fs.writeFile(temp,JSON.stringify(value,null,2)+"\n");await fs.rename(temp,target);}
console.log(`Validated FanGraphs lineups for ${date}: ${games.length} games, ${games.length*18} hitters`);
