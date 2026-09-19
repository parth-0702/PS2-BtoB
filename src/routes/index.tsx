import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Welcome } from "@/components/Welcome";
import { Wizard } from "@/components/Wizard";
import { SiteWorkspace } from "@/components/SiteWorkspace";
import { useSiteScope } from "@/lib/sitescope/store";
import { DEFAULT_ANSWERS } from "@/lib/sitescope/resolve";
import { businessConfig } from "@/lib/sitescope/analysis";
import type { City } from "@/lib/sitescope/types";
import "../workspace.css";

export const Route = createFileRoute("/")({ component: Index });
function Index() {
  const [view,setView]=useState<"landing"|"wizard"|"map">("landing");
  const state=useSiteScope();
  useEffect(()=>{if(useSiteScope.getState().city&&useSiteScope.getState().activeConfig)setView("map");},[]);
  function start(city:City){state.setCity(city);state.setWizardStep(0);setView("wizard");}
  function demo(city:City){state.setCity(city);state.setAnswers({...DEFAULT_ANSWERS,q1:{optionIds:["ev"]}});state.setResolved(businessConfig("ev"),["EV charging profile"],false);setView("map");}
  return view==="landing"?<Welcome onStart={start} onDemo={demo}/>:view==="wizard"?<Wizard onBack={()=>setView("landing")} onFinish={()=>setView("map")}/>:<SiteWorkspace onBack={()=>{state.setWizardStep(0);setView("wizard");}} onReset={()=>{state.reset();setView("landing");}}/>;
}
