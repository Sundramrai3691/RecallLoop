import { readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { appendAdjudications, appendAnnotations, buildAdjudicationReport, type AnnotationLedger } from "../services/evaluator/benchmarkAnnotationWorkflow.js";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../../..");
const base=path.join(root,"docs/research/ai-evaluation-v2");
const args=process.argv.slice(2);
const value=(key:string)=>{const i=args.indexOf(key);return i<0?undefined:args[i+1];};
const input=value("--in");
const kind=value("--kind")??"annotations";
const apply=args.includes("--apply");
if (!input || !["annotations","adjudications"].includes(kind)) {
  console.error("Usage: npm run benchmark:annotations -w server -- --in <submission.json> [--kind annotations|adjudications] [--apply]");
  process.exitCode=2;
} else {
  const dataset=JSON.parse(await readFile(path.join(base,"dataset.json"),"utf8"));
  const ledgerPath=path.join(base,"annotations/ledger.json");
  const ledger=JSON.parse(await readFile(ledgerPath,"utf8")) as AnnotationLedger;
  const submitted=JSON.parse(await readFile(path.resolve(root,input),"utf8"));
  const rows=Array.isArray(submitted)?submitted:submitted[kind];
  if (!Array.isArray(rows)) throw new Error(`Input must be a JSON array or contain a ${kind} array.`);
  const result=kind==="annotations"?appendAnnotations(ledger,rows,dataset.cases):appendAdjudications(ledger,rows,dataset.cases);
  if(result.errors.length){console.error(JSON.stringify({valid:false,errors:result.errors},null,2));process.exitCode=1;}
  else if(!apply){console.log(JSON.stringify({valid:true,kind,accepted:rows.length,write:false,message:"Preflight only. Re-run with --apply to append immutable records."},null,2));}
  else {
    const tempLedger=`${ledgerPath}.tmp`;
    await writeFile(tempLedger,JSON.stringify(result.ledger,null,2)+"\n",{flag:"wx"});
    await rename(tempLedger,ledgerPath);
    const report=buildAdjudicationReport(dataset,result.ledger);
    await writeFile(path.join(base,"adjudication-report.json"),JSON.stringify(report,null,2)+"\n");
    console.log(JSON.stringify({valid:true,kind,appended:rows.length,totalAnnotations:result.ledger.annotations.length,totalAdjudications:result.ledger.adjudications.length},null,2));
  }
}
