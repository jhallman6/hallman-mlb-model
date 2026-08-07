import { chromium } from "playwright-core";
import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

const ROOT = process.cwd();
const DATA = path.join(ROOT, "data");
const STATE = path.join(ROOT, ".refresh-state");
const PROFILE = path.join(STATE, "fangraphs-profile");
const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PAGE_SIZE = 200;
const SEASON = 2026;
const projections = [
  ["fangraphs-zips-update-hitting-2026.json", "https://www.fangraphs.com/projections?type=uzips&stats=bat&pos=all&team=0&players=0&lg=all&statgroup=dashboard&fantasypreset=dashboard"],
  ["fangraphs-zips-update-pitching-2026.json", "https://www.fangraphs.com/projections?type=uzips&stats=pit&pos=all&team=0&players=0&lg=all&statgroup=dashboard&fantasypreset=dashboard"],
  ["fangraphs-steamer-ros-hitting-vs-rhp-2026.json", "https://www.fangraphs.com/projections?type=rsteamer_vr_1&stats=bat&pos=all&team=0&players=0&lg=all&statgroup=dashboard&fantasypreset=dashboard"],
  ["fangraphs-steamer-ros-hitting-vs-lhp-2026.json", "https://www.fangraphs.com/projections?type=rsteamer_vl_1&stats=bat&pos=all&team=0&players=0&lg=all&statgroup=dashboard&fantasypreset=dashboard"],
  ["fangraphs-steamer-ros-pitching-vs-rhb-2026.json", "https://www.fangraphs.com/projections?type=rsteamer_vr_p_1&stats=pit&pos=all&team=0&players=0&lg=all&statgroup=pitcher-splits&fantasypreset=dashboard"],
  ["fangraphs-steamer-ros-pitching-vs-lhb-2026.json", "https://www.fangraphs.com/projections?type=rsteamer_vl_p_1&stats=pit&pos=all&team=0&players=0&lg=all&sortcol=3&sortdir=desc&statgroup=pitcher-splits&fantasypreset=dashboard"],
];

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const normalize = value => String(value ?? "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
async function exists(file) { try { await fs.access(file); return true; } catch { return false; } }
async function readJson(file) { return JSON.parse(await fs.readFile(file, "utf8")); }
async function writeJson(file, value) { await fs.mkdir(path.dirname(file), { recursive: true }); await fs.writeFile(file, JSON.stringify(value, null, 2) + "\n"); }
async function atomicJson(filename, value) {
  const target = path.join(DATA, filename);
  const temp = `${target}.${process.pid}.new`;
  await writeJson(temp, value);
  await fs.rename(temp, target);
}
async function waitForGrid(page) {
  await page.locator(".fg-data-grid").first().waitFor({ state: "visible", timeout: 45_000 });
  await page.locator(".fg-data-grid table tbody tr").first().waitFor({ state: "visible", timeout: 45_000 });
}
async function setPageSize(page) {
  const selects = page.locator(".fg-data-grid select");
  if (await selects.count() < 1) throw new Error("FanGraphs page-size control was not found");
  await selects.first().selectOption(String(PAGE_SIZE));
  await sleep(1800);
  await waitForGrid(page);
}
async function goToPage(page, number) {
  const input = page.locator(".fg-data-grid input.table-control-page").first();
  const before = await page.locator(".fg-data-grid table tbody tr").first().innerText();
  await input.fill(String(number));
  await input.press("Enter");
  await page.waitForFunction(({ number, before }) => {
    const field = document.querySelector(".fg-data-grid input.table-control-page");
    const row = document.querySelector(".fg-data-grid table tbody tr");
    return Number(field?.value) === number && row?.innerText !== before;
  }, { number, before }, { timeout: 45_000 });
  await sleep(500);
}
async function extractGrid(page) {
  return page.locator(".fg-data-grid table").first().evaluate(table => {
    const headers = [...table.querySelectorAll("thead th")].map(cell => cell.textContent.trim());
    const rows = [...table.querySelectorAll("tbody tr")].map(row => {
      const values = [...row.querySelectorAll("td")].map(cell => cell.textContent.trim());
      const href = row.querySelector('a[href*="/players/"]')?.getAttribute("href") ?? "";
      const match = href.match(/\/players\/[^/]+\/(\d+)/);
      return { playerId: match ? Number(match[1]) : null, values };
    });
    return { headers, rows, text: table.closest(".fg-data-grid")?.innerText ?? "" };
  });
}
function dedupeRows(rows) {
  const unique = new Map();
  for (const row of rows) {
    const key = row.playerId ? `id:${row.playerId}` : `name:${normalize(row.values[1])}`;
    if (!unique.has(key)) unique.set(key, row);
  }
  return [...unique.values()];
}
async function collectProjection(page, filename, sourceUrl) {
  const checkpoint = path.join(STATE, "checkpoints", `${filename}.checkpoint.json`);
  let saved = await exists(checkpoint) ? await readJson(checkpoint) : { sourceUrl, completedPage: 0, expected: null, rawCount: 0, headers: [], rows: [] };
  if (saved.sourceUrl !== sourceUrl || (saved.completedPage > 0 && !Number.isInteger(saved.rawCount))) saved = { sourceUrl, completedPage: 0, expected: null, rawCount: 0, headers: [], rows: [] };
  await page.goto(sourceUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await waitForGrid(page); await setPageSize(page);
  const first = await extractGrid(page);
  const match = first.text.match(/(?:\d[\d,]*\s*-\s*\d[\d,]*\s+)?of\s+([\d,]+)\s+results/i);
  if (!match) throw new Error(`${filename}: result count not found`);
  const expected = Number(match[1].replace(/,/g, ""));
  const pageCount = Math.ceil(expected / PAGE_SIZE);
  if (saved.expected !== expected) saved = { sourceUrl, completedPage: 0, expected, rawCount: 0, headers: first.headers, rows: [] };
  for (let pageNumber = saved.completedPage + 1; pageNumber <= pageCount; pageNumber++) {
    let extracted;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        if (pageNumber > 1) await goToPage(page, pageNumber);
        extracted = pageNumber === 1 ? first : await extractGrid(page);
        if (!extracted.rows.length || extracted.rows.length > PAGE_SIZE) throw new Error("invalid row count");
        break;
      } catch (error) {
        if (attempt === 3) throw new Error(`${filename}: page ${pageNumber} failed three times: ${error.message}`);
        await page.reload({ waitUntil: "domcontentloaded", timeout: 60_000 });
        await waitForGrid(page); await setPageSize(page);
      }
    }
    saved.headers = extracted.headers;
    saved.rawCount += extracted.rows.length;
    saved.rows = dedupeRows([...saved.rows, ...extracted.rows]);
    saved.completedPage = pageNumber;
    await writeJson(checkpoint, saved);
  }
  const unique = dedupeRows(saved.rows);
  if (saved.rawCount !== expected) throw new Error(`${filename}: collected ${saved.rawCount} source rows; FanGraphs reports ${expected}`);
  const old = await readJson(path.join(DATA, filename));
  await atomicJson(filename, { ...old, season: SEASON, fetchedAt: new Date().toISOString(), source: "FanGraphs", sourceUrl, headers: saved.headers, rows: unique });
  await fs.rm(checkpoint, { force: true });
  console.log(`Validated ${filename}: ${saved.rawCount}/${expected} source rows, ${unique.length} unique players`);
}
async function run(command, args) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: ROOT, stdio: "inherit", shell: true });
    child.on("exit", code => code === 0 ? resolve() : reject(new Error(`${command} exited with ${code}`)));
  });
}

await fs.mkdir(STATE, { recursive: true });
if (!await exists(PROFILE)) throw new Error("FanGraphs session is not initialized. Run npm run auth:fangraphs once.");
await run("node", ["scripts/refresh-savant.mjs"]);
await run("node", ["scripts/refresh-fangraphs-leaders.mjs"]);
await run("node", ["scripts/refresh-lineups.mjs"]);
// FanGraphs' Cloudflare protection rejects headless browser sessions. Keep this
// as a normal visible Edge window using the dedicated authenticated profile.
const context = await chromium.launchPersistentContext(PROFILE, { executablePath: EDGE, headless: false });
try {
  const page = context.pages()[0] ?? await context.newPage();
  page.setDefaultTimeout(45_000);
  for (const [filename, sourceUrl] of projections) {
    const current = await readJson(path.join(DATA, filename));
    if (String(current.fetchedAt ?? "").startsWith(new Date().toISOString().slice(0, 10)) && Array.isArray(current.rows) && current.rows.length) {
      console.log(`Already refreshed today: ${filename} (${current.rows.length} unique players)`);
      continue;
    }
    await collectProjection(page, filename, sourceUrl);
  }
} finally { await context.close(); }

const required = (await fs.readdir(DATA)).filter(name => /^(fangraphs|baseball-savant).*2026.*\.json$/.test(name) && !/^fangraphs-lineups-/.test(name));
const today = new Date().toISOString().slice(0, 10);
for (const filename of required) {
  const data = await readJson(path.join(DATA, filename));
  if (!Array.isArray(data.rows) || data.rows.length === 0) throw new Error(`${filename} is empty`);
  if (!String(data.fetchedAt ?? "").startsWith(today)) throw new Error(`${filename} was not refreshed today`);
}
await run("npm.cmd", ["run", "build"]);
console.log("Daily refresh and validation succeeded. The site is ready to publish.");
