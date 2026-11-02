import dotenv from "dotenv";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { performance } from "node:perf_hooks";
import path from "node:path";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";
import { MAX_PERFORMANCE_DURATION_MS, MAX_PERFORMANCE_REQUESTS, summarizeDurations, validatePerformanceDatabaseUrl } from "../observability/performanceBaselinePolicy.js";

const here = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(here, "../../../.env") });
dotenv.config();
if (process.env.RECALLLOOP_PERF_BASELINE !== "1") throw new Error("Set RECALLLOOP_PERF_BASELINE=1 to run this bounded benchmark.");
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL must be explicitly configured; no fallback database is allowed.");
for (const name of ["LLM_PROVIDER", "EMBEDDING_PROVIDER", "REMEDIATION_PROVIDER"]) process.env[name] = "mock";
process.env.PERFORMANCE_METRICS = "1";
process.env.REQUEST_LOGS = "0";

validatePerformanceDatabaseUrl(process.env.DATABASE_URL);
const extendedResourceProfile = process.argv.includes("--profile=extended");
const startedAt = Date.now();
let requestCount = 0;
let budgetExceeded = false;
const { postgres } = await import("../db/postgres.js");
const { createApp } = await import("../app.js");
const { resetPerformanceMetrics, performanceMetricsSnapshot, requestMetricsSnapshot } = await import("../observability/performanceMetrics.js");

type Metric = { operation: string; concurrency: number; totalRequests: number; succeeded: number; failed: number; timeouts: number; errorCategories: Record<string,number>; durationMs: number; throughputPerSecond: number; errorRate: number; p50Ms: number; p95Ms: number; p99Ms: number | null; };
const results: Metric[] = [];
const createdUsers: Array<{ id: string; email: string }> = [];
const accounts: Array<{ id: string; token: string; goalId: string }> = [];
const statuses: Record<string, number> = {};
const requestPayloadBytes=new Map<string,number[]>();
const responsePayloadBytes=new Map<string,number[]>();
const ingestionSamples:Array<{format:string;concurrency:number;inputBytes:number;extractedCharacters:number;chunkCount:number}> = [];

function appendSample(target:Map<string,number[]>,key:string,value:number){const values=target.get(key)??[];values.push(value);target.set(key,values);}
function summarizeBytes(values:Map<string,number[]>){return Object.fromEntries([...values.entries()].map(([key,samples])=>[key,summarizeDurations(samples)]));}

function assertBudget(additional = 1) {
  if (requestCount + additional > MAX_PERFORMANCE_REQUESTS) { budgetExceeded = true; throw new Error(`Hard request budget (${MAX_PERFORMANCE_REQUESTS}) reached.`); }
  if (Date.now() - startedAt > MAX_PERFORMANCE_DURATION_MS) { budgetExceeded = true; throw new Error(`Hard duration budget (${MAX_PERFORMANCE_DURATION_MS} ms) reached.`); }
  requestCount += additional;
}
async function runBatch(operation: string, concurrency: number, jobs: Array<() => Promise<unknown>>) {
  const latencies: number[] = []; let failed = 0; let timeouts = 0; let next = 0; const errorCategories:Record<string,number>={};
  const wallStart = performance.now();
  await Promise.all(Array.from({ length: Math.min(concurrency,jobs.length) }, async () => {
    while (next < jobs.length) {
      const index = next++;
      const start = performance.now();
      try { await jobs[index](); latencies.push(performance.now()-start); }
      catch (error) { failed++; const message=error instanceof Error?error.message:"unknown"; if (error instanceof Error && /timeout|abort/i.test(error.name+message)) timeouts++; const status=message.match(/HTTP (\d{3})/)?.[1];const category=status?`http_${status}`:/budget/i.test(message)?"harness_budget":"request_failed";errorCategories[category]=(errorCategories[category]??0)+1; }
    }
  }));
  if (budgetExceeded) throw new Error("Benchmark stopped at its hard execution budget; partial measurements were discarded.");
  const durationMs = performance.now()-wallStart;
  const sorted = [...latencies];
  const totalRequests = jobs.length;
  const timing=summarizeDurations(sorted);
  const metric: Metric = { operation, concurrency, totalRequests, succeeded: latencies.length, failed, timeouts, errorCategories, durationMs: Number(durationMs.toFixed(2)), throughputPerSecond: Number((totalRequests/(durationMs/1000)).toFixed(2)), errorRate: Number((failed/totalRequests).toFixed(4)), p50Ms: timing.p50Ms??0, p95Ms: timing.p95Ms??0, p99Ms: timing.p99Ms };
  results.push(metric);
  return metric;
}

async function main() {
  const identity = await postgres.query("SELECT current_database() AS database, current_user AS role, inet_server_addr()::text AS address, inet_server_port() AS port, version() AS version");
  if (identity.rows[0]?.database !== "recallloop") throw new Error("Connected database identity is not recallloop.");
  const server = createServer(createApp());
  await new Promise<void>((resolve,reject)=>{ server.once("error",reject); server.listen(0,"127.0.0.1",resolve); });
  const address = server.address(); if (!address || typeof address === "string") throw new Error("Could not bind benchmark API.");
  const origin = `http://127.0.0.1:${address.port}`;
  async function api<T=any>(account: { token:string },method:string,endpoint:string,body?:unknown,headers:Record<string,string>={}) {
    assertBudget();
    const metricKey=`${method} ${endpoint}`;
    appendSample(requestPayloadBytes,metricKey,body===undefined?0:body instanceof Uint8Array?body.byteLength:Buffer.byteLength(JSON.stringify(body)));
    const response = await fetch(`${origin}/api${endpoint}`,{method,headers:{authorization:`Bearer ${account.token}`,...(body instanceof Uint8Array?{}:{"content-type":"application/json"}),...headers},body:body===undefined?undefined:body instanceof Uint8Array?new Blob([new Uint8Array(body)]):JSON.stringify(body),signal:AbortSignal.timeout(10_000)});
    statuses[String(response.status)] = (statuses[String(response.status)]??0)+1;
    const text=await response.text();
    appendSample(responsePayloadBytes,metricKey,Buffer.byteLength(text));
    if(!response.ok) throw new Error(`HTTP ${response.status} for ${method} ${endpoint}: ${text.slice(0,300)}`);
    return text?JSON.parse(text) as T:null;
  }
  try {
    for (let index=0;index<10;index++) {
      const email=`perf-baseline-${randomUUID()}@example.invalid`;
      assertBudget();
      const registered=await fetch(`${origin}/api/auth/register`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({name:"Performance Pilot",email,password:"perf-baseline-safe-password"}),signal:AbortSignal.timeout(10_000)});
      if(!registered.ok) throw new Error(`Disposable registration failed with ${registered.status}.`);
      const data=await registered.json() as any;
      createdUsers.push({id:data.user.id,email});
      const account={id:data.user.id,token:data.token,goalId:""};
      const goal=await api<{goal:{id:string}}>(account,"POST","/goals",{title:`Perf baseline ${randomUUID()}`,goalType:"learning"});
      if(!goal)throw new Error("Goal creation returned no response.");
      account.goalId=goal.goal.id; accounts.push(account);
    }

    const readPaths=(account:typeof accounts[number])=>[
      ["dashboard","/dashboard/"],["goal.detail",`/goals/${account.goalId}`],["goal.readiness",`/goals/${account.goalId}/readiness`],["recalls.due","/recalls/due"],["learner.summary","/learner/summary"]
    ] as const;
    for(const concurrency of [1,5,10]) {
      const users=accounts.slice(0,concurrency);
      for(let endpointIndex=0;endpointIndex<5;endpointIndex++) {
        const jobs=Array.from({length:concurrency*10},(_,index)=>{const account=users[index%users.length];const [name,path]=readPaths(account)[endpointIndex];return async()=>{const response=await api(account,"GET",path);if(response==null)throw new Error(`${name} returned an empty body`);};});
        await runBatch(readPaths(users[0])[endpointIndex][0],concurrency,jobs);
      }
    }

    for(const concurrency of [1,5,10]) {
      const users=accounts.slice(0,concurrency);
        const jobs=Array.from({length:concurrency},(_,index)=>async()=>{
        const account=users[index%users.length]; const key=randomUUID();
        const payload={idempotencyKey:key,title:`Performance session ${key}`,rawMaterial:"# Transactions\nA transaction provides atomic commit or rollback for a group of database operations.\n\n# Indexes\nA B-tree index can accelerate selective lookups but adds write and storage cost.\n\n# Isolation\nSerializable isolation rejects executions that cannot be explained by a serial ordering."};
        const [first,retry]=await Promise.all([api<any>(account,"POST","/study-sessions",payload),api<any>(account,"POST","/study-sessions",payload)]);
        if(first.session.id!==retry.session.id) throw new Error("Concurrent same-key create returned different sessions.");
        const count=await postgres.query("SELECT count(*)::int AS count FROM study_sessions WHERE user_id=$1 AND idempotency_key=$2",[account.id,key]);
        if(count.rows[0].count!==1)throw new Error("Idempotency persisted more or fewer than one session.");
        const completed=await api<any>(account,"POST",`/study-sessions/${first.session.id}/complete`,{});
        const recall=completed.recalls?.[0];
        if(recall?.id){
          const answer=recall.questionType==="mcq"?{selectedOptionId:recall.questionData?.options?.[0]?.id,confidence:5}:{answer:"A transaction groups related operations so they commit together or roll back together; isolation controls how concurrent transactions interact.",confidence:5};
          await api(account,"POST",`/recalls/${recall.id}/submit`,answer);
        }
      });
      await runBatch("study.create-idempotent-complete-recall",concurrency,jobs);
    }

    const conceptResult=await postgres.query("SELECT id FROM canonical_concepts WHERE lower(name)='index selection' AND status='active' ORDER BY id LIMIT 1");
    if(!conceptResult.rows[0])throw new Error("The canonical Index selection benchmark concept is unavailable.");
    for(const concurrency of [1,5,10]){
      const users=accounts.slice(0,concurrency);
      const jobs=users.map(account=>async()=>{
        const assessment=await api<any>(account,"POST","/assessments",{canonicalConceptId:conceptResult.rows[0].id,mode:"rapid_fire"});
        if(!Array.isArray(assessment.questions)||assessment.questions.length===0)throw new Error("Canonical assessment returned no questions.");
        for(const question of assessment.questions){
          let answer:any={confidence:5};
          if(question.questionType==="mcq"){
            const option=question.questionData?.options?.[0];
            if(!option?.id)throw new Error("MCQ option shape is unavailable.");
            answer.selectedOptionId=option.id;
          }else if(Array.isArray(question.questionData?.parts)&&question.questionData.parts.length){
            answer.answers=question.questionData.parts.map((part:any)=>({partId:part.id,answer:"A B-tree stores ordered keys and can support lookup and range scans."}));
          }else answer.answer="A B-tree stores keys in ordered structure, supports equality and range lookups, and uses additional space and write work.";
          await api(account,"POST",`/recalls/${question.id}/submit`,answer);
        }
      });
      await runBatch("assessment.rapid-fire-submit",concurrency,jobs);
    }

    const pdfModule=await import("../services/grounding/pdfExtractorFixtures.js");
    async function makeDocx(unique:string,paragraphCount=1){
      const zip=new JSZip();
      zip.file("[Content_Types].xml",`<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`);
      zip.file("_rels/.rels",`<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`);
      const paragraphs=Array.from({length:paragraphCount},(_,index)=>`<w:p><w:r><w:t>${index+1}. Composite indexes can support queries on leading columns; transaction isolation determines which concurrent updates are visible. ${unique}</w:t></w:r></w:p>`).join("");
      zip.file("word/document.xml",`<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Indexes ${unique}</w:t></w:r></w:p>${paragraphs}<w:tbl><w:tr><w:tc><w:p><w:r><w:t>Example ${unique}</w:t></w:r></w:p></w:tc></w:tr></w:tbl><w:sectPr/></w:body></w:document>`);
      zip.file("word/styles.xml",`<?xml version="1.0"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/></w:style></w:styles>`);
      return zip.generateAsync({type:"nodebuffer",compression:"DEFLATE"});
    }
    for(const concurrency of [1,5,10]){
      const account=accounts[0];
      const resourceWorkload=extendedResourceProfile
        ? [["text",concurrency*2],["markdown",concurrency*2],["pdf.small",concurrency],["pdf.medium",Math.max(1,Math.ceil(concurrency/2))],["pdf.large",Math.max(1,Math.ceil(concurrency/2))],["docx",concurrency]] as const
        : [["text",concurrency*2],["markdown",concurrency*2],["pdf.small",concurrency],["docx",concurrency]] as const;
      for(const [kind,count] of resourceWorkload){
        const jobs=Array.from({length:count},(_,index)=>async()=>{
          const title=`Perf ${kind} ${randomUUID()}`;
          let response:any;
          if(kind==="text"||kind==="markdown"){
            const content=`# ${title}\n\n${"A locally indexed synthetic document covers transactions, isolation and B-tree indexes. ".repeat(90)} ${index}`;
            const input={title,text:content,sourceType:kind};
            response=await api<any>(account,"POST","/grounding/sources",input);
            var inputBytes=Buffer.byteLength(JSON.stringify(input));
          }else{
            const format=kind.startsWith("pdf")?"pdf":"docx";
            const pages=kind==="pdf.large"?40:kind==="pdf.medium"?10:2;
            const pageSize=kind==="pdf.large"?2000:kind==="pdf.medium"?1000:100;
            const bytes=format==="pdf"?pdfModule.makePdf(Array.from({length:pages},(_,page)=>`Page ${page+1}. ${`Synthetic indexed data supports ordered lookup, range scans, and transactional writes. ${title} `.repeat(Math.ceil(pageSize/80))}`)):await makeDocx(title,extendedResourceProfile?60:1);
            response=await api<any>(account,"POST",`/grounding/sources/${format}`,bytes,{"content-type":format==="pdf"?"application/pdf":"application/vnd.openxmlformats-officedocument.wordprocessingml.document","x-resource-title":title});
            var inputBytes=bytes.byteLength;
          }
          if(response?.source?.processingStatus!=="processed")throw new Error(`${kind} ingestion was not processed.`);
          const persisted=await postgres.query("SELECT char_length(s.content)::int AS extracted_characters,count(c.id)::int AS chunk_count FROM grounding_sources s LEFT JOIN grounding_chunks c ON c.source_id=s.id WHERE s.id=$1 AND s.user_id=$2 GROUP BY s.id",[response.source.id,account.id]);
          if(!persisted.rows[0])throw new Error("Ingested source could not be read back under its disposable owner.");
          ingestionSamples.push({format:kind,concurrency,inputBytes,extractedCharacters:persisted.rows[0].extracted_characters,chunkCount:persisted.rows[0].chunk_count});
        });
        await runBatch(`grounding.${kind}`,concurrency,jobs);
      }
    }

    const plans=[] as Array<{name:string;nodes:unknown}>;
    for(const account of accounts.slice(0,1)){
      const planQueries:Array<[string,string,unknown[]]> = [
        ["dashboard.due",`SELECT r.id FROM recall_attempts r JOIN review_states rs ON rs.user_id=r.user_id AND rs.concept_id=r.concept_id WHERE r.user_id=$1 AND r.submitted_at IS NULL AND rs.due_at <= now() ORDER BY rs.due_at`,[account.id]],
        ["session.idempotency",`SELECT id FROM study_sessions WHERE user_id=$1 AND idempotency_key=$2`,[account.id,randomUUID()]],
        ["readiness.latest",`SELECT DISTINCT ON (r.canonical_knowledge_point_id) r.canonical_knowledge_point_id,r.status,a.submitted_at FROM recall_attempts a JOIN recall_evaluations e ON e.recall_attempt_id=a.id JOIN recall_knowledge_point_results r ON r.evaluation_id=e.id WHERE a.user_id=$1 AND a.submitted_at IS NOT NULL AND r.canonical_knowledge_point_id IS NOT NULL ORDER BY r.canonical_knowledge_point_id,a.submitted_at DESC,a.id DESC`,[account.id]],
      ];
      for(const [name,sql,params] of planQueries){const result=await postgres.query(`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${sql}`,params);const raw=result.rows[0]["QUERY PLAN"][0];const reduce=(node:any):any=>({nodeType:node["Node Type"],relation:node["Relation Name"]??null,index:node["Index Name"]??null,estimatedRows:node["Plan Rows"],actualRows:node["Actual Rows"],loops:node["Actual Loops"],sharedHitBlocks:node["Shared Hit Blocks"]??0,sharedReadBlocks:node["Shared Read Blocks"]??0,children:(node.Plans??[]).map(reduce)});plans.push({name,nodes:{planningTimeMs:raw["Planning Time"],executionTimeMs:raw["Execution Time"],plan:reduce(raw.Plan)}});}
    }
    const report={schemaVersion:1,generatedAt:new Date().toISOString(),scope:"local-development-only",runtime:{node:process.version,platform:process.platform,architecture:process.arch,postgresVersion:identity.rows[0].version,applicationDatabase:identity.rows[0].database,databaseRole:identity.rows[0].role,serverAddress:identity.rows[0].address,serverPort:identity.rows[0].port,poolMax:10,providers:{llm:"mock",embeddings:"deterministic-local",remediation:"mock"}},limits:{maxRequests:MAX_PERFORMANCE_REQUESTS,maxDurationMs:MAX_PERFORMANCE_DURATION_MS,actualRequestCount:requestCount,actualDurationMs:Date.now()-startedAt,requestTimeoutMs:10_000},workload:{profile:extendedResourceProfile?"extended-source-size-exploration":"matched-before-after",concurrency:[1,5,10],disposableLearners:createdUsers.length,readRequestsPerEndpointPerLevel:[10,50,100],studyCyclesPerLevel:[1,5,10],assessmentFlowsPerLevel:[1,5,10],sourceIngestions:extendedResourceProfile?"text/markdown 2x concurrency, 2/10/40-page PDF fixtures and 60-paragraph DOCX":"text/markdown 2x concurrency, 2-page PDF and one-paragraph DOCX",syntheticOnly:true},apiResults:results,httpStatusCounts:statuses,requestMetrics:requestMetricsSnapshot(),httpPayloadBytes:{request:summarizeBytes(requestPayloadBytes),response:summarizeBytes(responsePayloadBytes)},ingestionSamples,databasePlans:plans,applicationMetrics:performanceMetricsSnapshot(),memory:{rssBeforeBytes:memoryBefore,rssAfterBytes:process.memoryUsage().rss,heapUsedAfterBytes:process.memoryUsage().heapUsed},providerLatencyMeasured:false,productionCapacityClaim:false};
    const root=path.resolve(here,"../../..");
    const outFlag=process.argv.indexOf("--out");
    const filename=outFlag>=0?process.argv[outFlag+1]:"baseline.json";
    if(!filename||path.basename(filename)!==filename||!filename.endsWith(".json"))throw new Error("--out must be a JSON filename without directory components.");
    const outputDirectory=path.join(root,"docs","performance","results");
    await fs.mkdir(outputDirectory,{recursive:true});
    const outputPath=path.join(outputDirectory,filename);
    await fs.writeFile(outputPath,`${JSON.stringify(report,null,2)}\n`,{flag:"wx"});
    process.stdout.write(`Performance report written to docs/performance/results/${filename}\n`);
    process.stdout.write(`${JSON.stringify({scope:report.scope,actualRequestCount:requestCount,actualDurationMs:report.limits.actualDurationMs,apiResults:results},null,2)}\n`);
  } finally {
    await new Promise<void>(resolve=>server.close(()=>resolve()));
    for(const user of createdUsers){await postgres.query("DELETE FROM app_users WHERE id=$1 AND email=$2",[user.id,user.email]);}
    const remaining=createdUsers.length?await postgres.query("SELECT count(*)::int AS count FROM app_users WHERE id=ANY($1::uuid[])", [createdUsers.map(user=>user.id)]):{rows:[{count:0}]};
    if(remaining.rows[0].count!==0) throw new Error("Benchmark cleanup could not verify removal of all owned users.");
    await postgres.end();
  }
}

const memoryBefore=process.memoryUsage().rss;
resetPerformanceMetrics();
await main();
