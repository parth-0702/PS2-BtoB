import { useEffect, useMemo, useRef, useState } from "react";
import * as maplibre from "maplibre-gl";
import mapWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import "maplibre-gl/dist/maplibre-gl.css";
import { Crosshair, Minus, Plus, Maximize2 } from "lucide-react";
import type { FeatureCollection, Feature, Geometry } from "geojson";
import type { ScoredHex } from "@/lib/sitescope/scoring";
import type { Point, TravelBand } from "@/lib/sitescope/analysis";

export interface DisplayLayer { id:string; label:string; visible:boolean; opacity:number; color:string }
export interface UploadedLayer { name:string; data:FeatureCollection; visible:boolean }
interface Props {
  center:Point; cells:ScoredHex[]; selected:string|null; top:ScoredHex[];
  layers:DisplayLayer[]; overlay:string; competitors:{lngLat:Point;name:string}[];
  clusters:{hull:Point[];size:number}[]; bands:TravelBand[]; polygon:Point[];
  drawing:boolean; placing:boolean; uploaded:UploadedLayer[]; before:boolean;
  onSelect:(id:string)=>void; onPoint:(p:Point)=>void;
}
export function scoreColor(score:number) {return score>=0.8?"#176c51":score>=0.65?"#5aa786":score>=0.5?"#a7c9a5":score>=0.35?"#e9cb91":"#d58c78";}
const collection=(features:Feature[]):FeatureCollection=>({type:"FeatureCollection",features});
export function ExplorerMap(props:Props) {
  const container=useRef<HTMLDivElement>(null),mapRef=useRef<maplibre.Map|null>(null),latest=useRef(props);
  latest.current=props;
  const [ready,setReady]=useState(false),[error,setError]=useState(false),[tileError,setTileError]=useState(false);
  const [satellite,setSatellite]=useState(false);
  const geo=useMemo(()=>collection(props.cells.map(h=>({type:"Feature",geometry:{type:"Polygon",coordinates:[[...h.boundary,h.boundary[0]!]]},properties:{
    id:h.h3,color:scoreColor(h.score),selected:h.h3===props.selected,eligible:h.eligible,
    population:h.population,accessibility:h.accessibility,competition:h.competition,rent:1-h.rent,
    landuse:h.landuse,risk:h.floodRisk,footfall:h.footfall,complementary:h.complementary,
    hot:h.gi_z>1.96,cold:h.gi_z< -1.96,underserved:h.underserved,
  }}))),[props.cells,props.selected]);
  useEffect(()=>{
    if(!container.current)return;
    maplibre.setWorkerUrl(mapWorkerUrl);
    let map:maplibre.Map;
    try{map=new maplibre.Map({container:container.current,center:props.center,zoom:11.8,attributionControl:{compact:true},style:{version:8,sources:{
      basemap:{type:"raster",tiles:["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],tileSize:256,attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'},
      satellite:{type:"raster",tiles:["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],tileSize:256,attribution:"Tiles © Esri"},
    },layers:[{id:"background",type:"background",paint:{"background-color":"#eef1e9"}},{id:"basemap",type:"raster",source:"basemap",paint:{"raster-saturation":-0.9,"raster-opacity":0.55}},{id:"satellite",type:"raster",source:"satellite",layout:{visibility:"none"}}]}});}catch{setError(true);return;}
    mapRef.current=map;
    map.on("error",e=>{if(e.error?.message?.includes("WebGL"))setError(true);else setTileError(true);});
    map.on("load",()=>{
      map.addSource("cells",{type:"geojson",data:geo});
      map.addLayer({id:"scores",type:"fill",source:"cells",paint:{"fill-color":["case",["get","eligible"],["get","color"],"#b9bfbd"],"fill-opacity":0.65}});
      for(const l of latest.current.layers.filter(l=>l.id!=="score"))map.addLayer({id:`factor-${l.id}`,type:"fill",source:"cells",paint:{"fill-color":l.color,"fill-opacity":["*",["get",l.id],0]}});
      map.addLayer({id:"grid",type:"line",source:"cells",paint:{"line-color":"#ffffff","line-width":0.6,"line-opacity":0.65}});
      map.addLayer({id:"analysis",type:"fill",source:"cells",paint:{"fill-color":["case",["get","hot"],"#cd775a",["get","cold"],"#779bbc","#836ac0"],"fill-opacity":0},filter:["==",["get","hot"],true]});
      map.addLayer({id:"selected",type:"line",source:"cells",filter:["==",["get","selected"],true],paint:{"line-color":"#164b3b","line-width":3}});
      map.addSource("points",{type:"geojson",data:collection([])});
      map.addLayer({id:"competitors",type:"circle",source:"points",paint:{"circle-radius":4,"circle-color":"#ca8469","circle-stroke-color":"white","circle-stroke-width":1.5}});
      map.addSource("extras",{type:"geojson",data:collection([])});
      map.addLayer({id:"extra-fill",type:"fill",source:"extras",filter:["==",["geometry-type"],"Polygon"],paint:{"fill-color":["get","color"],"fill-opacity":0.13}});
      map.addLayer({id:"extra-line",type:"line",source:"extras",filter:["!=",["geometry-type"],"Point"],paint:{"line-color":["get","color"],"line-width":2,"line-dasharray":[3,2]}});
      map.addLayer({id:"extra-point",type:"circle",source:"extras",filter:["==",["geometry-type"],"Point"],paint:{"circle-color":["get","color"],"circle-radius":5,"circle-stroke-width":2,"circle-stroke-color":"white"}});
      map.addSource("uploaded",{type:"geojson",data:collection([])});
      map.addLayer({id:"upload-fill",type:"fill",source:"uploaded",filter:["==",["geometry-type"],"Polygon"],paint:{"fill-color":"#9b70c4","fill-opacity":0.2}});
      map.addLayer({id:"upload-line",type:"line",source:"uploaded",filter:["!=",["geometry-type"],"Point"],paint:{"line-color":"#8251b0","line-width":2}});
      map.addLayer({id:"upload-point",type:"circle",source:"uploaded",filter:["==",["geometry-type"],"Point"],paint:{"circle-color":"#8251b0","circle-radius":5}});
      map.on("click",e=>{
        const p=latest.current;
        if(p.drawing||p.placing){p.onPoint([e.lngLat.lng,e.lngLat.lat]);return;}
        const hit=map.queryRenderedFeatures(e.point,{layers:["scores"]})[0];
        if(hit?.properties?.['id'])p.onSelect(String(hit.properties['id']));
      });
      map.on("mousemove",()=>{map.getCanvas().style.cursor=latest.current.drawing||latest.current.placing?"crosshair":"pointer";});
      if(import.meta.env.DEV)map.once("idle",()=>console.debug("SiteScope map diagnostics",JSON.stringify({cells:latest.current.cells.length,sourceFeatures:map.querySourceFeatures("cells").length,rendered:map.queryRenderedFeatures({layers:["scores"]}).length,loaded:map.isSourceLoaded("cells")})));
      setReady(true);
    });
    const resize=new ResizeObserver(()=>map.resize());resize.observe(container.current);
    return ()=>{resize.disconnect();map.remove();mapRef.current=null;};
  },[]);
  useEffect(()=>{if(!ready)return;const map=mapRef.current!;
    (map.getSource("cells") as maplibre.GeoJSONSource).setData(geo);
    const score=props.layers.find(l=>l.id==="score")!;
    map.setPaintProperty("scores","fill-opacity",score.visible?score.opacity/100:0);
    for(const l of props.layers.filter(l=>l.id!=="score"))map.setPaintProperty(`factor-${l.id}`,"fill-opacity",["*",["get",l.id],l.visible?l.opacity/100:0]);
    map.setPaintProperty("analysis","fill-opacity",props.overlay==="none"||props.overlay==="clusters"?0:0.6);
    map.setFilter("analysis",props.overlay==="hotspots"?["any",["get","hot"],["get","cold"]]:["==",["get","underserved"],true]);
    (map.getSource("points") as maplibre.GeoJSONSource).setData(collection(props.competitors.map(c=>({type:"Feature",geometry:{type:"Point",coordinates:c.lngLat},properties:{}}))));
    map.setLayoutProperty("competitors","visibility",props.layers.find(l=>l.id==="competition")?.visible?"visible":"none");
    const extras:Feature[]=[];
    const add=(geometry:Geometry,color:string)=>extras.push({type:"Feature",geometry,properties:{color}});
    if(props.polygon.length>=3)add({type:"Polygon",coordinates:[[...props.polygon,props.polygon[0]!]]},"#297b66");
    else if(props.polygon.length>=2)add({type:"LineString",coordinates:props.polygon},"#297b66");
    props.polygon.forEach(p=>add({type:"Point",coordinates:p},"#297b66"));
    if(props.overlay==="clusters")props.clusters.forEach(c=>add({type:"Polygon",coordinates:[c.hull]},"#aa6eae"));
    for(const band of [...props.bands].reverse()){const ids=new Set(band.cells);for(const h of props.cells)if(ids.has(h.h3))add({type:"Polygon",coordinates:[[...h.boundary,h.boundary[0]!]]},band.minutes===10?"#285f9b":band.minutes===20?"#6b7fc0":"#afa1cb");}
    (map.getSource("extras") as maplibre.GeoJSONSource).setData(collection(extras));
    (map.getSource("uploaded") as maplibre.GeoJSONSource).setData(collection(props.uploaded.filter(l=>l.visible).flatMap(l=>l.data.features)));
  },[ready,geo,props.layers,props.overlay,props.competitors,props.clusters,props.polygon,props.bands,props.uploaded]);
  useEffect(()=>{if(ready)mapRef.current?.flyTo({center:props.center,zoom:11.8});},[ready,props.center]);
  useEffect(()=>{const m=mapRef.current;if(ready&&m){m.setLayoutProperty("satellite","visibility",satellite?"visible":"none");m.setLayoutProperty("basemap","visibility",satellite?"none":"visible");}},[ready,satellite]);
  useEffect(()=>{if(!ready)return;const map=mapRef.current!;const markers=props.top.slice(0,3).map((h,i)=>{const el=document.createElement("button");el.className=`site-pin ${h.h3===props.selected?"active":""}`;el.textContent=String(i+1);el.title=`Rank ${i+1}: ${h.score100}/100`;el.onclick=e=>{e.stopPropagation();latest.current.onSelect(h.h3);};return new maplibre.Marker({element:el}).setLngLat(h.center).addTo(map);});return()=>markers.forEach(m=>m.remove());},[ready,props.top,props.selected]);
  return <div className="explorer-map">
    <div ref={container} className="map-canvas" />
    {error&&<div className="map-fallback"><p>WebGL unavailable. Interactive grid view.</p><div className="fallback-grid">{props.cells.map(h=><button key={h.h3} title={`${h.h3}: ${h.score100}`} style={{background:scoreColor(h.score)}} onClick={()=>props.onSelect(h.h3)}>{h.score100}</button>)}</div></div>}
    <div className="map-top-controls"><div className="segmented"><button className={!satellite?"active":""} onClick={()=>setSatellite(false)}>Light map</button><button className={satellite?"active":""} onClick={()=>setSatellite(true)}>Satellite</button></div><span className="map-label">{props.before?"BASELINE":"LIVE ANALYSIS"}</span></div>
    <div className="map-zoom"><button aria-label="Zoom in" onClick={()=>mapRef.current?.zoomIn()}><Plus size={17}/></button><button aria-label="Zoom out" onClick={()=>mapRef.current?.zoomOut()}><Minus size={17}/></button><button aria-label="Recenter map" onClick={()=>mapRef.current?.flyTo({center:props.center,zoom:11.8})}><Crosshair size={17}/></button><button aria-label="Fullscreen map" onClick={()=>{if(document.fullscreenElement)void document.exitFullscreen();else void container.current?.parentElement?.requestFullscreen();}}><Maximize2 size={16}/></button></div>
    {(props.drawing||props.placing)&&<div className="map-instruction">{props.drawing?"Click to draw your search boundary. Finish with ‘Apply area’.":"Click the map to add a simulated competitor."}</div>}
    <div className="map-legend"><span>Site readiness</span><div className="legend-gradient"/><div><span>Lower potential</span><span>Higher potential</span></div></div>
    {tileError&&<span className="tile-notice">Some map tiles unavailable · analysis remains active</span>}
  </div>;
}
