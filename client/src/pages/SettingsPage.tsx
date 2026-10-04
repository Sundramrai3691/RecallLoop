import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { PageHeader } from "../components/Ui";
import { api } from "../api/client";
import { ApiError } from "../types";

export function SettingsPage() {
  const [mode,setMode]=useState<"automatic"|"confirm"|"manual">("automatic"); const [saved,setSaved]=useState(false); const [error,setError]=useState<string|null>(null); const [loading,setLoading]=useState(true); const [busy,setBusy]=useState(false);
  useEffect(()=>{void api.getSettings().then((data)=>setMode(data.reviewMode)).catch((err)=>setError(err instanceof ApiError?"We couldn’t load your review preference.":"We couldn’t load your review preference.")).finally(()=>setLoading(false));},[]);
  async function save(){setBusy(true);setSaved(false);setError(null);try{const result=await api.updateSettings(mode);setMode(result.reviewMode);setSaved(true);}catch{setError("We couldn’t save this preference. Please try again.");}finally{setBusy(false);}}
  return <div><PageHeader eyebrow="Your preferences" title="Settings" description="Choose how review dates fit into your routine."/><section className="card settings-card"><h2>Review schedule</h2><p className="muted">Choose how RecallLoop handles suggested review dates after a recall.</p>{loading?<div className="grid"><div className="skeleton"/><div className="skeleton"/></div>:<><label htmlFor="review-mode">Review mode</label><select id="review-mode" value={mode} onChange={(event)=>{setMode(event.target.value as typeof mode);setSaved(false);}}><option value="automatic">Automatic</option><option value="confirm">Ask me to confirm dates</option><option value="manual">Manual</option></select><p className="metadata">{mode==="automatic"?"Use the suggested review date automatically.":mode==="confirm"?"Review and adjust each suggested date before it is saved.":"Choose review dates yourself. Due reviews will still appear in your plan."}</p><div className="actions"><button className="btn btn-primary" type="button" onClick={()=>void save()} disabled={busy}>{busy?"Saving…":"Save preference"}</button>{saved?<span className="saved-state" role="status"><Check size={15}/> Saved</span>:null}</div></>}{error?<p className="error" role="alert">{error}</p>:null}</section></div>;
}
