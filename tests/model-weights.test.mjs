import assert from "node:assert/strict";
import test from "node:test";
import { applyRateOverrides, workbookPaWeights } from "../app/modelWeights.ts";

test("Héctor Rodríguez regression: current and ROS PA weights match the workbook rule", () => {
  const weights = workbookPaWeights(3, 120, 526, 195);
  assert.equal(weights.hitterPaPct, 0.025);
  assert.ok(Math.abs(weights.pitcherPaPct - (526 / 721)) < 1e-12);
  assert.ok(Math.abs(weights.paPct - 0.3772711511789182) < 1e-12);
  assert.ok(Math.abs(weights.rosPaPct - 0.6227288488210818) < 1e-12);
});

test("PA weights are finite, bounded, and always sum to 100%", () => {
  for (const inputs of [[0,0,0,0],[5,100,20,480],[900,600,700,0],[NaN,100,Infinity,20]]) {
    const weights = workbookPaWeights(...inputs);
    for (const key of ["hitterPaPct","pitcherPaPct","paPct","rosPaPct"]) {
      assert.ok(Number.isFinite(weights[key]), `${key} must be finite`);
      assert.ok(weights[key] >= 0 && weights[key] <= 1, `${key} must be between 0 and 1`);
    }
    assert.ok(Math.abs(weights.paPct + weights.rosPaPct - 1) < 1e-12);
  }
});

test("pitcher PA% uses full-season TBF, never remaining ROS TBF alone", () => {
  const weights = workbookPaWeights(3, 120, 526, 195);
  assert.ok(weights.pitcherPaPct < 1);
  assert.notEqual(weights.pitcherPaPct, 526 / 195);
});

test("manual EXP-rate edits change downstream hit and out probabilities", () => {
  const row={k:.25,bb:.08,hr:.03,babip:.3,nonHrHit:.189,out:.7218};
  const edited=applyRateOverrides(row,{k:.35,babip:.34});
  assert.equal(edited.k,.35);
  assert.equal(edited.babip,.34);
  assert.notEqual(edited.nonHrHit,row.nonHrHit);
  assert.notEqual(edited.out,row.out);
  assert.ok(edited.nonHrHit+edited.hr>=0);
});
