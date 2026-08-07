import { chromium } from "playwright-core";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import path from "node:path";

const profile = path.resolve(".refresh-state/fangraphs-profile");
const executablePath = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const context = await chromium.launchPersistentContext(profile, { executablePath, headless: false });
const page = context.pages()[0] ?? await context.newPage();
await page.goto("https://www.fangraphs.com/projections?type=uzips&stats=bat", { waitUntil: "domcontentloaded" });
const rl = createInterface({ input, output });
await rl.question("Sign in to FanGraphs in the browser, then press Enter here to save the session. ");
rl.close();
await context.close();
console.log("FanGraphs session saved.");
