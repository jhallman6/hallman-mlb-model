import { chromium } from "playwright-core";
import fs from "node:fs/promises";
import path from "node:path";
const DATA=path.resolve("data"),PROFILE=path.resolve(".refresh-state/fangraphs-profile"),EDGE="C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",SIZE=200;
const files=["fangraphs-batted-ball-2026.json","fangraphs-bat-tracking-2026.json","fangraphs-pitcher-batted-ball-2026.json","fangraphs-pitcher-standard-2026.json","fangraphs-pitcher-statcast-2026.json","fangraphs-pitcher-location-plus-2026.json"];
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const num=v=>v===""||v==null?null:Number(String(v).replace(/[%,$]/g,""));
const pct=v=>{const n=num(v);return n==null?null:n/100;};
const norm=v=>String(v??"").toLowerCase().replace(/[^a-z0-9]+/g,"");
async function atomic(name,value){const t=path.join(DATA,name),n=`${t}.${process.pid}.new`;await fs.writeFile(n,JSON.stringify(value,null,2)+"\n");await fs.rename(n,t);}
async function grid(page){return page.locator(".fg-data-grid table").first().evaluate(table=>({headers:[...table.querySelectorAll("thead th")].map(x=>[...x.childNodes].filter(n=>n.nodeType===Node.TEXT_NODE).map(n=>n.textContent).join('').trim()||x.getAttribute('data-col-id')||x.textContent.trim()),rows:[...table.querySelectorAll("tbody tr")].map(tr=>{const values=[...tr.querySelectorAll("td")].map(x=>x.textContent.trim());const href=tr.querySelector('a[href*="/players/"]')?.getAttribute('href')??'';return{values,playerId:Number(href.match(/\/players\/[^/]+\/(\d+)/)?.[1])||null}}),text:table.closest('.fg-data-grid')?.innerText??''}));}
async function collect(page,url){await page.goto(url,{waitUntil:"domcontentloaded",timeout:60000});await page.locator('.fg-data-grid table tbody tr').first().waitFor({state:'visible',timeout:60000});const selects=page.locator('.fg-data-grid select');await selects.first().selectOption(String(SIZE));await sleep(2200);let first=await grid(page);const expected=Number(first.text.match(/\d[\d,]*\s*-\s*\d[\d,]*\s+of\s+([\d,]+)\s+results/i)?.[1]?.replace(/,/g,''));if(!expected)throw new Error(`Result total missing for ${url}`);const all=[];for(let n=1;n<=Math.ceil(expected/SIZE);n++){let data;if(n===1)data=first;else{const input=page.locator('.fg-data-grid input.table-control-page').first();await input.fill(String(n));await input.press('Enter');await page.waitForFunction(x=>Number(document.querySelector('.fg-data-grid input.table-control-page')?.value)===x,n,{timeout:45000});await sleep(1300);data=await grid(page);}all.push(...data.rows);}if(all.length!==expected)throw new Error(`${url}: ${all.length}/${expected}`);const identities=all.map(row=>row.playerId?`id:${row.playerId}`:`name:${norm(row.values[1])}`);if(new Set(identities).size!==expected)throw new Error(`${url}: duplicate or missing players (${new Set(identities).size}/${expected} unique)`);return{headers:first.headers,rows:all,expected};}
function value(row,headers,...names){const keys=headers.map(norm);for(const name of names){const wanted=norm(name);let i=keys.indexOf(wanted);if(i<0)i=keys.findIndex(key=>key.startsWith(wanted));if(i>=0)return row.values[i];}return null;}
function validFraction(v){return Number.isFinite(v)&&v>=0&&v<=1;}
function validateMapped(name,rows,fields){if(!rows.length)throw new Error(`${name}: empty`);for(const field of fields){const present=rows.filter(row=>Number.isFinite(row[field]));if(present.length/rows.length<0.95)throw new Error(`${name}: only ${present.length}/${rows.length} valid ${field} values`);if(field.endsWith('Pct')&&present.some(row=>!validFraction(row[field])))throw new Error(`${name}: invalid ${field} range`);}}
const context=await chromium.launchPersistentContext(PROFILE,{executablePath:EDGE,headless:false});
try{
  const page=context.pages()[0]??await context.newPage();
  for(const name of files){
    const old=JSON.parse(await fs.readFile(path.join(DATA,name),'utf8'));
    const url=old.sourceUrl??old.source;
    const got=await collect(page,url);
    let next;
    if(name==='fangraphs-batted-ball-2026.json'){
      const rows=got.rows.map((r,i)=>({rank:i+1,playerId:r.playerId,name:value(r,got.headers,'Name'),team:value(r,got.headers,'Team'),gbPct:pct(value(r,got.headers,'GB%')),fbPct:pct(value(r,got.headers,'FB%')),hardHitPct:pct(value(r,got.headers,'Hard%','HardHit%')),pullPct:pct(value(r,got.headers,'Pull%'))}));
      validateMapped(name,rows,['gbPct','fbPct','hardHitPct','pullPct']);
      next={...old,fetchedAt:new Date().toISOString(),rows};
    }else if(name==='fangraphs-bat-tracking-2026.json'){
      const rows=got.rows.map((r,i)=>({rank:i+1,playerId:r.playerId,name:value(r,got.headers,'Name'),team:value(r,got.headers,'Team'),competitiveSwings:num(value(r,got.headers,'CompetitiveSwings','CompSw','Competitive Swings','Comp Swings')),batSpeed:num(value(r,got.headers,'AvgBatSpeed','BatSpd','Bat Speed')),fastSwingPct:pct(value(r,got.headers,'FastSwing%','FastSw%','Fast Swing%')),swingLength:num(value(r,got.headers,'SwingLength','SwgLng','Swing Length')),squaredContactPct:pct(value(r,got.headers,'SquaredUpContact%','SqUpCon%','Squared-Up Contact%')),squaredSwingPct:pct(value(r,got.headers,'SquaredUpSwing%','SqUpSw%','Squared-Up Swing%')),blastContactPct:pct(value(r,got.headers,'BlastContact%','BlastCon%','Blast Contact%')),blastSwingPct:pct(value(r,got.headers,'BlastSwing%','BlastSw%','Blast Swing%')),tilt:num(value(r,got.headers,'Tilt')),attackAngle:num(value(r,got.headers,'AttackAngle','AtkAng','Attack Angle')),attackDirection:num(value(r,got.headers,'AttackDirection','AtkDir','Attack Direction')),idealAttackAnglePct:pct(value(r,got.headers,'IdealAttackAngle%','IdealAtkAng%','Ideal Attack Angle%'))}));
      validateMapped(name,rows,['competitiveSwings','batSpeed','fastSwingPct','swingLength','squaredContactPct','squaredSwingPct','blastContactPct','blastSwingPct','tilt','attackAngle','attackDirection','idealAttackAnglePct']);
      next={...old,fetchedAt:new Date().toISOString(),rows};
    }else{
      if(!got.headers.length||got.rows.some(r=>r.values.length!==got.headers.length))throw new Error(`${name}: header/row width mismatch`);
      next={...old,fetchedAt:new Date().toISOString(),headers:got.headers,rows:got.rows.map(r=>r.values),playerIds:got.rows.map(r=>r.playerId)};
    }
    await atomic(name,next);
    console.log(`Validated ${name}: ${got.expected}`);
  }
}finally{await context.close();}
