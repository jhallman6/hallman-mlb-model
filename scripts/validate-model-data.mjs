import fs from 'node:fs/promises';
import path from 'node:path';

const DATA=path.resolve('data');
const read=async name=>JSON.parse(await fs.readFile(path.join(DATA,name),'utf8'));
const finite=value=>Number.isFinite(value);
function assert(ok,message){if(!ok)throw new Error(message);}

const hitters=await read('baseball-savant-hitter-pitches-bb-2026.json');
assert(hitters.rows.length>500,'Savant hitter dataset is unexpectedly small');
for(const row of hitters.rows){
  assert(finite(row.pitches)&&row.pitches>=0,`Invalid hitter pitches: ${row.player}`);
  for(const key of ['totalStrikes','totalSwingingStrikes','calledStrikes','foulStrikes','threeOhPitches'])assert(finite(row[key])&&row[key]>=0&&row[key]<=row.pitches,`Invalid hitter ${key}: ${row.player}`);
  for(const key of ['totalSwingingStrikes','calledStrikes','foulStrikes'])assert(row[key]<=row.totalStrikes,`${key} exceeds strikes: ${row.player}`);
}

const pitchers=await read('baseball-savant-pitcher-results-2026.json');
assert(pitchers.rows.length>600,'Savant pitcher dataset is unexpectedly small');
for(const row of pitchers.rows){
  assert(finite(row.totalPitches)&&row.totalPitches>=0,`Invalid pitcher pitches: ${row.player}`);
  for(const key of ['totalSwingingStrikes','calledStrikes','foulStrikes','threeOhPitches'])assert(finite(row[key])&&row[key]>=0&&row[key]<=row.totalPitches,`Invalid pitcher ${key}: ${row.player}`);
  assert(row.pullAirPct==null||(finite(row.pullAirPct)&&row.pullAirPct>=0&&row.pullAirPct<=100),`Invalid Pull Air%: ${row.player}`);
}

for(const [name,fields] of [
  ['fangraphs-batted-ball-2026.json',['gbPct','fbPct','hardHitPct','pullPct']],
  ['fangraphs-bat-tracking-2026.json',['competitiveSwings','batSpeed','fastSwingPct','swingLength','squaredContactPct','squaredSwingPct','blastContactPct','blastSwingPct','tilt','attackAngle','attackDirection','idealAttackAnglePct']],
]){
  const data=await read(name);
  assert(data.rows.length>500,`${name} is unexpectedly small`);
  for(const field of fields){
    const valid=data.rows.filter(row=>finite(row[field]));
    assert(valid.length/data.rows.length>=0.95,`${name} has insufficient ${field} coverage`);
    if(field.endsWith('Pct'))assert(valid.every(row=>row[field]>=0&&row[field]<=1),`${name} has invalid ${field} values`);
  }
}

for(const name of ['fangraphs-pitcher-batted-ball-2026.json','fangraphs-pitcher-standard-2026.json','fangraphs-pitcher-statcast-2026.json','fangraphs-pitcher-location-plus-2026.json']){
  const data=await read(name);
  assert(data.rows.length>600,`${name} is unexpectedly small`);
  assert(Array.isArray(data.headers)&&data.headers.length>3,`${name} has no headers`);
  assert(data.rows.every(row=>Array.isArray(row)&&row.length===data.headers.length),`${name} has a header/row width mismatch`);
  const names=data.rows.map(row=>String(row[1]??'').trim()).filter(Boolean);
  assert(new Set(names).size===names.length,`${name} contains duplicate pitcher rows`);
}

for(const name of ['fangraphs-zips-update-hitting-2026.json','fangraphs-zips-update-pitching-2026.json','fangraphs-steamer-ros-hitting-vs-rhp-2026.json','fangraphs-steamer-ros-hitting-vs-lhp-2026.json','fangraphs-steamer-ros-pitching-vs-rhb-2026.json','fangraphs-steamer-ros-pitching-vs-lhb-2026.json']){
  const data=await read(name);
  assert(Array.isArray(data.rows)&&data.rows.length>500,`${name} is unexpectedly small`);
  assert(Array.isArray(data.headers)&&data.headers.length>3,`${name} has no headers`);
  assert(data.rows.every(row=>Array.isArray(row.values)&&row.values.length===data.headers.length),`${name} has a header/row width mismatch`);
}

console.log('All model data passed schema, coverage, and range validation.');
