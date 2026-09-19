import { gridDisk, cellArea, UNITS } from "h3-js";
import { distanceKm } from "./scoring";
import { resolveAnswers, DEFAULT_ANSWERS } from "./resolve";
import type { CityData, ScoringConfig } from "./types";
export type Point = [number, number];
export interface Scenario { growth: number; accessLoss: number; flood: number; competitors: Point[]; anchor: Point | null }
export const EMPTY_SCENARIO: Scenario = { growth:0, accessLoss:0, flood:0, competitors:[], anchor:null };
export function applyScenario(data: CityData, scenario: Scenario): CityData {
  return {...data, competitors:[...data.competitors,...scenario.competitors.map((lngLat,i)=>({id:`scenario-${i}`,name:"Simulated competitor",lngLat}))],
    hexes:data.hexes.map(h=>{
      const influence = scenario.anchor ? Math.exp(-distanceKm(h.center,scenario.anchor)/1.5) : 1;
      return {...h,population:Math.min(1,h.population*(1+scenario.growth/100)),
        accessibility:Math.max(0,h.accessibility-scenario.accessLoss/100*influence),
        floodRisk:Math.min(1,h.floodRisk+scenario.flood/100*influence)};
    })};
}
export function insidePolygon(point: Point, polygon: Point[]) {
  let inside=false;
  for(let i=0,j=polygon.length-1;i<polygon.length;j=i++) {
    const a=polygon[i]!,b=polygon[j]!;
    if((a[1]>point[1]) !== (b[1]>point[1]) && point[0]<(b[0]-a[0])*(point[1]-a[1])/(b[1]-a[1])+a[0]) inside=!inside;
  }
  return inside;
}
export function convexHull(points: Point[]): Point[] {
  const sorted=[...points].sort((a,b)=>a[0]-b[0] || a[1]-b[1]);
  const cross=(o:Point,a:Point,b:Point)=>(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]);
  const half=(pts:Point[])=>{const h:Point[]=[];for(const p of pts){while(h.length>=2 && cross(h[h.length-2]!,h[h.length-1]!,p)<=0)h.pop();h.push(p);}return h;};
  const lower=half(sorted),upper=half([...sorted].reverse());
  const hull=[...lower.slice(0,-1),...upper.slice(0,-1)];
  return hull.length>=3 ? [...hull,hull[0]!] : [];
}
export function clusters(points: Point[], eps=0.8, min=3) {
  const labels=new Array<number>(points.length).fill(-2);
  const neighbors=(i:number)=>points.flatMap((p,j)=>distanceKm(points[i]!,p)<=eps?[j]:[]);
  let id=0;
  points.forEach((_,i)=>{
    if(labels[i]!==-2)return;
    const ns=neighbors(i); if(ns.length<min){labels[i]=-1;return;}
    labels[i]=id;const queue=new Set(ns);
    for(const j of queue){if(labels[j]===-1)labels[j]=id;if(labels[j]!==-2)continue;labels[j]=id;const next=neighbors(j);if(next.length>=min)next.forEach(k=>queue.add(k));}
    id++;
  });
  return Array.from({length:id},(_,i)=>{const pts=points.filter((_,j)=>labels[j]===i);return {id:i,size:pts.length,hull:convexHull(pts)};}).filter(c=>c.hull.length);
}
export interface TravelBand { minutes:number; population:number; area:number; cells:string[] }
export function travelBands(data:CityData, start:string, mode:"walk"|"drive"):TravelBand[] {
  // Dijkstra over H3 neighbors. Demo network cost reflects accessibility, not real roads.
  const byId=new Map(data.hexes.map(h=>[h.h3,h]));
  const costs=new Map<string,number>([[start,0]]),visited=new Set<string>();
  while(true){let next:string|undefined;let cost=Infinity;for(const [id,v] of costs)if(!visited.has(id)&&v<cost){next=id;cost=v;}
    if(!next || cost>30)break;visited.add(next);const a=byId.get(next);if(!a)break;
    for(const id of gridDisk(next,1)){const b=byId.get(id);if(!b||visited.has(id))continue;
      const speed=mode==="walk"?4.8:12+24*(a.accessibility+b.accessibility)/2;
      const c=cost+distanceKm(a.center,b.center)*1.25/speed*60;
      if(c<(costs.get(id)??Infinity))costs.set(id,c);
    }
  }
  return [10,20,30].map(minutes=>{const cells=data.hexes.filter(h=>(costs.get(h.h3)??Infinity)<=minutes);return {minutes,cells:cells.map(h=>h.h3),population:Math.round(cells.reduce((s,h)=>s+h.population*4200,0)),area:cells.reduce((s,h)=>s+cellArea(h.h3,UNITS.km2),0)};});
}
export function businessConfig(id:string):ScoringConfig {
  const result=resolveAnswers({...DEFAULT_ANSWERS,q1:{optionIds:[id]},q6:{optionIds:[]}}).config;
  result.weights={...result.weights,landuse:0.08,risk:0.08};
  if(id==="ev"){result.weights={population:20,footfall:5,accessibility:30,complementary:5,competition:20,rent:5,landuse:5,risk:10};result.isochroneMode="drive";result.constraints=["no_flood"];}
  if(id==="warehouse"){result.weights={population:5,footfall:0,accessibility:35,complementary:5,competition:5,rent:25,landuse:15,risk:10};result.landUseTable={industrial:1,commercial:0.8,mixed:0.4,residential:0};result.isochroneMode="drive";}
  return result;
}
export function interpretBrief(text:string, config:ScoringConfig) {
  const t=text.toLowerCase();let next:ScoringConfig={...config,weights:{...config.weights},constraints:[...config.constraints]};const notes:string[]=[];
  const business=t.match(/\b(ev|cafe|café|retail|warehouse|clinic|gym|restaurant|grocery|pharmacy)\b/)?.[1];
  if(business){next=businessConfig(business==="café"?"cafe":business);notes.push(`Applied ${business} business profile`);}
  const boost=(key:string,label:string)=>{const sum=Object.values(next.weights).reduce((s,v)=>s+v,0);next.weights[key]=(next.weights[key]??0)+sum*0.3;notes.push(label);};
  if(/highway|access|transit|road/.test(t))boost("accessibility","Prioritized road and transit accessibility");
  if(/population|resident|famil/.test(t))boost("population","Prioritized residential demand");
  if(/footfall|foot traffic|busy/.test(t))boost("footfall","Prioritized foot traffic");
  if(/afford|cheap|budget|rent/.test(t))boost("rent","Prioritized lower rent");
  if(/flood/.test(t)){next.constraints.push("no_flood");notes.push("Excluded cells with flood risk above 45%");}
  if(/parking/.test(t)){next.constraints.push("needs_parking");notes.push("Required parking availability");}
  if(/competitor|competition/.test(t)){next.competitionMode=/cluster/.test(t)?"cluster":"avoid";boost("competition",`Competition preference: ${next.competitionMode}`);const km=t.match(/(\d+(?:\.\d+)?)\s*km/);if(km){next.competitionRadius=Math.max(100,Math.min(10000,Number(km[1])*1000));notes.push(`Competitor search radius: ${next.competitionRadius/1000} km (scoring preference)`);}}
  const minutes=t.match(/(10|20|30)\s*min/);if(minutes){next.isochroneMinutes=Number(minutes[1]);next.isochroneMode=/walk/.test(t)?"walk":"drive";notes.push(`Catchment: ${minutes[1]} minute ${next.isochroneMode}`);}
  if(/\d[\d,]*\s*(people|residents)|no competitor|no competition/.test(t))notes.push("Population minimums and absolute competitor exclusions are not enforced by this local parser; inspect catchment and competition values.");
  next.constraints=[...new Set(next.constraints)];
  return {config:next,notes:notes.length?notes:["No supported preferences found. Try ‘EV near highways, low flood risk, avoid competitors within 2 km’."],business};
}
