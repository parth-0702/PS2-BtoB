import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCityData } from '../src/lib/sitescope/mock-data.ts';
import { scoreCity, topSites } from '../src/lib/sitescope/scoring.ts';
import { applyScenario, EMPTY_SCENARIO, businessConfig, travelBands, insidePolygon, clusters, interpretBrief } from '../src/lib/sitescope/analysis.ts';
const data=buildCityData('ahmedabad');
const config=businessConfig('ev');

test('all scores are finite 0–100 and factor contributions reconcile',()=>{
  const scores=scoreCity(data,config);
  assert.equal(scores.length,631);
  for(const h of scores){assert.ok(h.score100>=0&&h.score100<=100);assert.ok(Number.isFinite(h.gi));assert.ok(Math.abs(h.parts.reduce((s,p)=>s+p.contribution,0)-h.score)<1e-9);}
});
test('hard constraints exclude every invalid recommendation',()=>{
  const scores=scoreCity(data,{...config,constraints:['no_flood','needs_parking','ground_floor_commercial','max_rent']});
  assert.ok(scores.some(h=>!h.eligible));
  for(const h of topSites(scores,631)){assert.equal(h.eligible,true);assert.equal(h.blockedBy.length,0);assert.ok(h.raw.floodRisk<=.45);assert.ok(h.raw.parking>=.35);assert.ok(['commercial','mixed'].includes(h.raw.landuse));}
});
test('each configurable layer affects the score and zero values remain zero',()=>{
  for(const key of Object.keys(config.weights)){
    const h=scoreCity(data,{...config,weights:{[key]:1}})[0];
    assert.equal(h.parts.length,1);assert.equal(h.score,h.parts[0].value);
  }
  const zeros={...data,hexes:data.hexes.map(h=>({...h,population:0}))};
  assert.equal(scoreCity(zeros,{...config,weights:{population:1}})[0].score,0);
});
test('neutral competition is neutral and radius/decay change scoring',()=>{
  assert.ok(scoreCity(data,{...config,competitionMode:'neutral'}).every(h=>h.subscores.competition===50));
  const near=scoreCity(data,{...config,competitionRadius:500});
  const far=scoreCity(data,{...config,competitionRadius:5000});
  assert.ok(near.some((h,i)=>h.score!==far[i].score));
  const decay=scoreCity(data,{...config,decayD0:8000});
  assert.ok(decay.some((h,i)=>h.score!==scoreCity(data,config)[i].score));
});
test('adding a competitor reduces an avoidance score without mutating baseline',()=>{
  const baseline=scoreCity(data,config);const chosen=topSites(baseline,1)[0];
  const changed=applyScenario(data,{...EMPTY_SCENARIO,competitors:[chosen.center]});
  const after=scoreCity(changed,config).find(h=>h.h3===chosen.h3);
  assert.ok(after.score<chosen.score);assert.equal(changed.competitors.length,data.competitors.length+1);
  assert.deepEqual(scoreCity(data,config),baseline);
});
test('local disruption affects selected site more than distant sites',()=>{
  const anchor=data.hexes[0];const after=applyScenario(data,{...EMPTY_SCENARIO,anchor:anchor.center,accessLoss:50,flood:50});
  assert.ok(after.hexes[0].accessibility<anchor.accessibility);
  assert.ok(after.hexes[0].floodRisk>anchor.floodRisk);
  assert.ok(after.hexes.every(h=>h.accessibility>=0&&h.floodRisk<=1));
});
test('network catchments are nested and driving reaches at least walking population',()=>{
  const walk=travelBands(data,data.hexes[0].h3,'walk'),drive=travelBands(data,data.hexes[0].h3,'drive');
  for(let i=0;i<3;i++){assert.ok(drive[i].population>=walk[i].population);if(i>0){assert.ok(walk[i].population>=walk[i-1].population);assert.ok(walk[i-1].cells.every(id=>walk[i].cells.includes(id)));}}
});
test('DBSCAN separates dense groups and ignores noise',()=>{
  const result=clusters([[72,23],[72.001,23],[72,23.001],[73,24],[73.001,24],[73,24.001],[70,20]],.5,3);
  assert.equal(result.length,2);assert.ok(result.every(c=>c.size===3&&c.hull.length===4));
});
test('polygon filtering distinguishes inside from outside',()=>{
  const polygon=[[0,0],[2,0],[2,2],[0,2]];assert.ok(insidePolygon([1,1],polygon));assert.ok(!insidePolygon([3,1],polygon));
});
test('brief interpreter applies supported intent and discloses unsupported strict constraints',()=>{
  const result=interpretBrief('EV near highways, low flood risk, no competitor within 3 km, drive 20 minutes',config);
  assert.equal(result.config.competitionRadius,3000);assert.equal(result.config.isochroneMinutes,20);assert.ok(result.config.constraints.includes('no_flood'));
  assert.ok(result.notes.some(n=>n.includes('not enforced')));
});
