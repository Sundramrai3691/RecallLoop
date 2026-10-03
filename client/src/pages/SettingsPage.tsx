import { useEffect, useState } from "react";
import { api } from "../api/client";
import { ApiError } from "../types";

export function SettingsPage() {
  const [mode,setMode]=useState<"automatic"|"confirm"|"manual">("automatic");
  const [saved,setSaved]=useState(false);
  const [error,setError]=useState<string|null>(null);
  useEffect(()=>{api.getSettings().then((data)=>setMode(data.reviewMode)).catch((err)=>setError(err instanceof ApiError?err.message:"Could not load settings"));},[]);
  async function save(){setSaved(false);setError(null);try{const result=await api.updateSettings(mode);setMode(result.reviewMode);setSaved(true);}catch(err){setError(err instanceof ApiError?err.message:"Could not save settings");}}
  return <section className="card"><h1>Review preferences</h1><p>ReviewState remains the source of scheduled recall dates. This preference controls how the plan handles future review suggestions.</p><label htmlFor="review-mode">Review mode</label><select id="review-mode" value={mode} onChange={(event)=>setMode(event.target.value as typeof mode)}><option value="automatic">Automatic</option><option value="confirm">Confirm suggested dates</option><option value="manual">Manual</option></select><p className="muted">Automatic keeps the scheduler’s recommendation. Confirm asks you to accept or adjust a suggested date. Manual keeps future review tasks out of optional plan work; due reviews still appear.</p><button className="btn btn-primary" type="button" onClick={()=>void save()}>Save preference</button>{saved?<p role="status">Saved.</p>:null}{error?<p className="error">{error}</p>:null}</section>;
}
