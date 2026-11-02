import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { Pool } from "pg";
import JSZip from "jszip";
import { chromium, firefox } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
dotenv.config({ path: path.join(root, ".env") });
assert(process.env.DATABASE_URL, "Core browser pilot requires an explicitly configured DATABASE_URL");
const databaseUrl = new URL(process.env.DATABASE_URL);
assert(["127.0.0.1", "localhost", "::1"].includes(databaseUrl.hostname), "Browser pilot cleanup is limited to loopback PostgreSQL");
assert(databaseUrl.pathname === "/recallloop", "Browser pilot requires the configured local recallloop database");

const email = `e2e-core-${Date.now()}-${Math.random().toString(16).slice(2)}@test.local`;
const password = `Pilot-${Math.random().toString(36).slice(2)}-${Date.now()}`;
const ownedEmails = [email];
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const processes = [];
let browser;
let browserContext;
let page;
let userId;
let userInfoPreload;
let browserJavaScriptErrors = [];
let unexpectedFailedRequests = [];
let expectedCanceledRequests = [];
let expectedLostStudyResponses = [];
let studyResponseDropArmed = false;
let traceStarted = false;
const browserName = process.argv.includes("--browser=firefox") ? "firefox" : process.argv.includes("--browser=edge") ? "edge" : process.env.RECALLLOOP_E2E_BROWSER ?? "edge";
assert(["edge", "firefox"].includes(browserName), `Unsupported E2E browser: ${browserName}`);
const localAppOriginForClassification = "http://127.0.0.1:5173";
assert.equal(isExpectedCanceledRequest("GET", `${localAppOriginForClassification}/api/knowledge/roles`, "NS_BINDING_ABORTED", localAppOriginForClassification), true);
assert.equal(isExpectedCanceledRequest("POST", `${localAppOriginForClassification}/api/knowledge/roles`, "NS_BINDING_ABORTED", localAppOriginForClassification), false);
assert.equal(isExpectedCanceledRequest("GET", `${localAppOriginForClassification}/api/knowledge/roles/extra`, "NS_BINDING_ABORTED", localAppOriginForClassification), false);
assert.equal(isExpectedCanceledRequest("GET", `${localAppOriginForClassification}/api/knowledge/roles`, "ECONNRESET", localAppOriginForClassification), false);
assert.equal(isExpectedCanceledRequest("GET", "https://example.test/api/knowledge/roles", "NS_BINDING_ABORTED", localAppOriginForClassification), false);
if (browserName === "firefox" && !existsSync(firefox.executablePath())) {
  throw new Error(`Playwright Firefox is not installed at ${firefox.executablePath()}. Run "npx playwright install firefox" or use the Firefox CI workflow.`);
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => { const port = server.address().port; server.close((error) => error ? reject(error) : resolve(port)); });
  });
}
function isExpectedCanceledRequest(method, requestUrl, failureText, appOrigin) {
  const parsedUrl = new URL(requestUrl);
  return method === "GET"
    && parsedUrl.pathname === "/api/knowledge/roles"
    && failureText === "NS_BINDING_ABORTED"
    && parsedUrl.origin === appOrigin;
}
function isExpectedInjectedStudyResponseDrop(method, requestUrl, failureText, appOrigin) {
  const parsedUrl = new URL(requestUrl);
  return method === "POST" && parsedUrl.pathname === "/api/study-sessions" && failureText === "net::ERR_FAILED" && parsedUrl.origin === appOrigin;
}
function partialBaselineAnswer(point) {
  const stopwords = new Set(["the", "a", "an", "and", "or", "of", "to", "in", "on", "for", "with", "is", "are", "was", "be", "as", "by", "from", "that", "this", "it", "into", "then"]);
  const tokens = point.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((token) => token.length > 2 && !stopwords.has(token));
  assert(tokens.length >= 3, `A partial baseline fixture needs at least 3 significant tokens: ${point}`);
  return tokens.slice(0, Math.max(1, Math.floor(tokens.length * 0.4))).join(" ");
}
function start(name, args, cwd, env) {
  const child = spawn(process.execPath, args, { cwd, env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
  let output = ""; const save = (chunk) => { output = `${output}${chunk}`.slice(-5000); };
  child.stdout.on("data", save); child.stderr.on("data", save);
  const entry = { name, child, get output() { return output; } }; processes.push(entry); return entry;
}
async function waitFor(url, entry) {
  const end = Date.now() + 20_000;
  while (Date.now() < end) {
    if (entry.child.exitCode !== null) throw new Error(`${entry.name} exited: ${entry.output}`);
    try { const res = await fetch(url, { signal: AbortSignal.timeout(800) }); if (res.ok) return; } catch { /* startup */ }
    await new Promise((resolve) => setTimeout(resolve, 120));
  }
  throw new Error(`${entry.name} did not serve ${url}: ${entry.output}`);
}
async function stop(entry) {
  if (entry.child.exitCode !== null || entry.child.signalCode !== null) return;
  entry.child.kill("SIGTERM");
  await Promise.race([new Promise((resolve) => entry.child.once("exit", resolve)), new Promise((resolve) => setTimeout(resolve, 3000))]);
  if (entry.child.exitCode === null && entry.child.signalCode === null) entry.child.kill("SIGKILL");
}
async function authenticatedApi(token, url, init = {}) {
  const response = await fetch(url, { ...init, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(init.headers ?? {}) } });
  const body = await response.json();
  assert(response.ok, `${init.method ?? "GET"} ${url} failed: ${JSON.stringify(body)}`);
  return body;
}
function pdfFixture(pageTexts) {
  const objects = [];
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  const pageIds = pageTexts.map((_text, index) => 3 + index * 2);
  objects[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;
  pageTexts.forEach((text, index) => {
    const pageId = pageIds[index]; const contentId = pageId + 1;
    objects[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${pageIds.length * 2 + 3} 0 R >> >> /Contents ${contentId} 0 R >>`;
    const stream = text ? `BT /F1 12 Tf 72 720 Td ${text.split(/\r?\n/).map((line) => line ? `(${line.replace(/([\\()])/g, "\\$1")}) Tj T*` : "T*").join(" ")} ET` : "";
    objects[contentId] = `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`;
  });
  objects[pageIds.length * 2 + 3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
  const chunks = [Buffer.from("%PDF-1.7\n%----\n", "ascii")]; const offsets = [0]; let offset = chunks[0].length;
  for (let id = 1; id < objects.length; id++) { offsets[id] = offset; const object = Buffer.from(`${id} 0 obj\n${objects[id]}\nendobj\n`, "ascii"); chunks.push(object); offset += object.length; }
  const xrefOffset = offset; let xref = `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id++) xref += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  xref += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  chunks.push(Buffer.from(xref, "ascii")); return Buffer.concat(chunks);
}
async function docxFixture({malformed=false}={}) {
  if(malformed)return Buffer.from("This is not a Word document", "utf8");
  const zip=new JSZip();
  zip.file("[Content_Types].xml",`<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`);
  zip.file("_rels/.rels",`<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`);
  zip.file("word/_rels/document.xml.rels",`<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/></Relationships>`);
  zip.file("word/styles.xml",`<?xml version="1.0"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/></w:style></w:styles>`);
  zip.file("word/numbering.xml",`<?xml version="1.0"?><w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:abstractNum w:abstractNumId="0"><w:lvl w:ilvl="0"><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/></w:lvl></w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num></w:numbering>`);
  const p=(value,style="")=>`<w:p>${style?`<w:pPr><w:pStyle w:val="${style}"/></w:pPr>`:""}<w:r><w:t xml:space="preserve">${value}</w:t></w:r></w:p>`;
  const body=p("Index selection","Heading1")+p("A composite B-tree index on tenant_id and created_at supports the leading tenant_id prefix. Indexes add write cost and storage.")+`<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr><w:r><w:t>Queries using only the second key generally cannot use the same efficient lookup.</w:t></w:r></w:p><w:tbl><w:tr><w:tc>${p("SQL")}</w:tc><w:tc>${p("CREATE INDEX idx_orders_tenant ON orders (tenant_id, created_at);")}</w:tc></w:tr></w:tbl>`;
  zip.file("word/document.xml",`<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr/></w:body></w:document>`);
  return zip.generateAsync({type:"nodebuffer",compression:"DEFLATE"});
}
async function waitForAssessment(token, url, assessmentId, predicate) {
  const end = Date.now() + 10_000;
  while (Date.now() < end) {
    const result = await authenticatedApi(token, `${url}/api/assessments/${assessmentId}`);
    if (predicate(result)) return result;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Assessment state did not settle after submitting an answer");
}

try {
  console.log(`Starting ${browserName} Playwright core journey.`);
  const apiPort = await freePort(); const clientPort = await freePort();
  const apiUrl = `http://127.0.0.1:${apiPort}`; const clientUrl = `http://127.0.0.1:${clientPort}`;
  const childEnv = { ...process.env, PORT: String(apiPort), CLIENT_ORIGIN: clientUrl, LLM_PROVIDER: "mock", LLM_API_KEY: "", EMBEDDING_PROVIDER: "mock", EMBEDDING_API_KEY: "", REMEDIATION_PROVIDER: "mock" };
  userInfoPreload = path.join(tmpdir(), `recallloop-userinfo-${process.pid}.cjs`);
  await writeFile(userInfoPreload, "const os=require('node:os');const original=os.userInfo;os.userInfo=()=>{try{return original()}catch{return {uid:-1,gid:-1,username:'local-user',homedir:os.homedir(),shell:''}}};", "ascii");
  const preloadArgument = `--require=\"${userInfoPreload.replaceAll("\\", "/")}\"`;
  const apiEnv = { ...childEnv, NODE_OPTIONS: [process.env.NODE_OPTIONS, preloadArgument].filter(Boolean).join(" ") };
  const apiProcess = start("mock-provider API", [path.join(root, "node_modules/tsx/dist/cli.mjs"), "src/index.ts"], path.join(root, "server"), apiEnv);
  await waitFor(`${apiUrl}/api/health`, apiProcess);
  const clientProcess = start("Vite production preview", [path.join(root, "node_modules/vite/bin/vite.js"), "preview", "--configLoader", "runner", "--host", "127.0.0.1", "--port", String(clientPort), "--strictPort"], path.join(root, "client"), { ...childEnv, API_PROXY_TARGET: apiUrl });
  await waitFor(clientUrl, clientProcess);
  browser = browserName === "firefox"
    ? await firefox.launch({ headless: true })
    : await chromium.launch({ channel: "msedge", headless: true });
  console.log(`Started ${browserName} ${browser.version()}.`);
  browserContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  page = await browserContext.newPage();
  browserJavaScriptErrors = [];
  unexpectedFailedRequests = [];
  expectedCanceledRequests = [];
  if (process.env.RECALLLOOP_E2E_TRACE === "1") {
    await browserContext.tracing.start({ screenshots: true, snapshots: true, sources: true });
    traceStarted = true;
  }
  page.on("pageerror", (error) => browserJavaScriptErrors.push(error.message));
  page.on("requestfailed", (request) => {
    const failureText = request.failure()?.errorText ?? "request failed";
    if (isExpectedCanceledRequest(request.method(), request.url(), failureText, new URL(clientUrl).origin)) {
      expectedCanceledRequests.push(`${request.method()} ${request.url()}: ${failureText}`);
      return;
    }
    unexpectedFailedRequests.push(`${request.method()} ${request.url()}: ${failureText}`);
  });
  await page.route("https://fonts.googleapis.com/**", (route) => route.fulfill({ status: 200, contentType: "text/css", body: "" }));
  await page.route("https://fonts.gstatic.com/**", (route) => route.fulfill({ status: 204, body: "" }));

  await page.goto(`${clientUrl}/register`, { waitUntil: "commit", timeout: 10_000 });
  try { await page.locator("#name").waitFor({ timeout: 10_000 }); }
  catch { throw new Error(`Register screen did not render (url=${page.url()}, title=${await page.title()}, body=${JSON.stringify((await page.locator("body").innerText()).slice(0,600))}, browserJavaScriptErrors=${JSON.stringify(browserJavaScriptErrors)}, unexpectedFailedRequests=${JSON.stringify(unexpectedFailedRequests)}, expectedCanceledRequests=${JSON.stringify(expectedCanceledRequests)})`); }
  const apiSecurityHeaders = await page.evaluate(async () => {
    const response = await fetch("/api/health/live");
    return {
      status: response.status,
      contentTypeOptions: response.headers.get("x-content-type-options"),
      frameOptions: response.headers.get("x-frame-options"),
      referrerPolicy: response.headers.get("referrer-policy"),
    };
  });
  assert.deepEqual(apiSecurityHeaders, { status: 200, contentTypeOptions: "nosniff", frameOptions: "DENY", referrerPolicy: "strict-origin-when-cross-origin" }, "The production preview's proxied API must return the configured browser security headers");
  await page.locator("#name").fill("RecallLoop Core Pilot");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL("**/onboarding", { timeout: 10_000 });
  const token = await page.evaluate(() => localStorage.getItem("recallloop_token"));
  assert(token, "The supported registration flow should establish a learner session");
  userId = (await pool.query("SELECT id FROM app_users WHERE email=$1", [email])).rows[0]?.id;
  assert(userId, "The registered test learner must persist in PostgreSQL");
  await page.locator("#start-topic").waitFor({ timeout: 10_000 });
  const onboardingSkill = await page.locator("#start-topic option").evaluateAll((options) => options.find((option) => option.value)?.value ?? "");
  assert(onboardingSkill, "Onboarding should offer a knowledge-map focus area");
  await page.locator("#start-topic").selectOption(onboardingSkill);
  assert.equal(await page.getByRole("button", { name: /Not sure/ }).getAttribute("aria-pressed"), "true", "A new learner starts with an unknown baseline rather than assumed mastery");
  await page.getByRole("button", { name: "Start studying" }).click();
  await page.waitForURL(/\/study\/new\?topic=/, { timeout: 10_000 });
  const onboardingGoalId = new URL(page.url()).searchParams.get("goalId");
  assert(onboardingGoalId, "Onboarding should route to a first learning activity for the saved goal");
  const onboardingGoal = await pool.query("SELECT id FROM goals WHERE id=$1 AND user_id=$2", [onboardingGoalId, userId]);
  const onboardingSkills = await pool.query("SELECT id FROM learner_skills WHERE goal_id=$1 AND user_id=$2", [onboardingGoalId, userId]);
  assert.equal(onboardingGoal.rowCount, 1, "Onboarding should persist the learner's goal");
  assert.equal(onboardingSkills.rowCount, 1, "Onboarding should persist the selected focus skill");
  const baselineEvidence = await pool.query("SELECT count(*)::int AS count FROM recall_attempts WHERE user_id=$1", [userId]);
  assert.equal(baselineEvidence.rows[0].count, 0, "Choosing an unknown starting point must not fabricate baseline evidence");
  await page.reload({ waitUntil: "domcontentloaded" });
  assert.equal(await page.evaluate(() => localStorage.getItem("recallloop_token")), token, "The registered learner session should survive reload");

  // A protected API request from the address bar is expected to reject a
  // missing token. Verify the real API boundary, then simulate that precise
  // response at the browser boundary so Vite's proxy cannot make the test
  // depend on a transient local network reset.
  const unauthenticatedSessions = await fetch(`${apiUrl}/api/study-sessions`);
  assert.equal(unauthenticatedSessions.status, 401, "Study sessions remain private without a bearer token");
  await page.route("**/api/study-sessions", (route) => route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ error: "Authentication required", code: "UNAUTHORIZED" }) }));
  await page.goto(`${clientUrl}/study/new`, { waitUntil: "domcontentloaded" });
  await page.locator("#study-topic").fill("Authentication");
  await page.locator("#material").fill("Authentication verifies the identity associated with a request. Authorization determines which actions that identity may perform.");
  await page.getByRole("button", { name: "Create study session" }).click();
  await page.getByRole("alert").filter({ hasText: "sign-in is missing or has expired" }).waitFor();
  await page.getByRole("link", { name: "Open sign in in a new tab" }).waitFor();
  assert.equal(await page.locator("#study-topic").inputValue(), "Authentication", "An unauthorized create preserves the topic draft");
  assert((await page.locator("#material").inputValue()).includes("Authorization determines"), "An unauthorized create preserves the pasted material");
  await page.unroute("**/api/study-sessions");
  await page.getByRole("button", { name: "Create study session" }).click();
  await page.waitForURL("**/study/*", { timeout: 10_000 });
  await page.locator("h1").filter({ hasText: "Authentication" }).waitFor();

  const goal = await authenticatedApi(token, `${apiUrl}/api/goals`, { method: "POST", body: JSON.stringify({ title: `Core DBMS pilot ${Date.now()}`, description: "Evidence-backed database learning check", goalType: "interview", weeklyTimeBudgetMinutes: 60 }) });
  const goalId = goal.goal?.id ?? goal.id;
  await authenticatedApi(token, `${apiUrl}/api/goals/${goalId}/skills`, { method: "POST", body: JSON.stringify({ name: "Databases", description: "Core database concepts", priority: 1 }) });

  await page.goto(`${clientUrl}/resources`, { waitUntil: "domcontentloaded" });
  await page.locator("details.source-contribution summary").click();
  await page.locator("#material-type").selectOption("web_article");
  await page.locator("#material-url").fill("http://127.0.0.1/");
  await page.getByRole("button", { name: "Import article" }).click();
  await page.getByRole("alert").filter({ hasText: "not available for import" }).waitFor({ timeout: 5000 });
  assert.equal((await authenticatedApi(token, `${apiUrl}/api/grounding/sources`)).sources.length, 0, "A blocked local URL must not create a source row");
  await page.locator("#material-type").selectOption("video");
  await page.getByRole("status").filter({ hasText: "Video transcripts are not available" }).waitFor();
  await page.locator("#material-type").selectOption("text");
  await page.locator("#material-reference").fill("");
  await page.locator("#material-title").fill("DBMS index notes");
  await page.locator("#material-text").fill("A composite B-tree index on (tenant_id, created_at) supports predicates on its leading column, and can support predicates on both columns. It generally cannot provide an efficient lookup using created_at alone. Indexes improve selected reads but require storage and add maintenance to writes. Query plans should be checked against the actual predicate and ordering.");
  await page.getByRole("button", { name: "Save learning material" }).click();
  await page.getByRole("status").filter({ hasText: "source was extracted" }).waitFor({ timeout: 10_000 });
  const storedSources = await authenticatedApi(token, `${apiUrl}/api/grounding/sources`);
  assert.equal(storedSources.sources[0].processingStatus, "processed");
  await page.locator("#material-type").selectOption("markdown");
  await page.locator("#material-file").setInputFiles({ name: "index-reference.md", mimeType: "text/markdown", buffer: Buffer.from("# Index reference\n\nComposite indexes are most useful when queries constrain leading columns. Indexes add write cost and use storage.", "utf8") });
  await page.waitForFunction(() => document.querySelector("#material-text")?.value.includes("leading columns") === true, null, { timeout: 3000 });
  await page.getByRole("button", { name: "Save learning material" }).click();
  await page.getByRole("status").filter({ hasText: "source was extracted" }).waitFor({ timeout: 10_000 });
  assert.equal((await authenticatedApi(token, `${apiUrl}/api/grounding/sources`)).sources.length, 2, "The TXT/Markdown upload should enter the existing grounding library");
  await page.locator("#material-type").selectOption("pdf");
  const pdfBuffer = pdfFixture([
    "A composite B-tree index on tenant_id and created_at supports predicates on the leading tenant_id column and can also use created_at.",
    "",
    "A composite index generally cannot provide an efficient lookup when a query filters only by created_at. Indexes add write cost and storage.",
  ]);
  await page.locator("#material-file").setInputFiles({ name: "dbms-index-guide.pdf", mimeType: "application/pdf", buffer: pdfBuffer });
  await page.getByRole("status").filter({ hasText: "dbms-index-guide.pdf" }).waitFor();
  await page.getByRole("button", { name: "Upload PDF" }).click();
  await page.waitForFunction(() => document.querySelector(".notice")?.textContent.includes("Extracted text from 3 PDF pages") || document.querySelector("[role='alert']")?.textContent, null, { timeout: 10_000 });
  if (!(await page.locator(".notice").textContent().catch(() => ""))?.includes("Extracted text from 3 PDF pages")) {
    const state = await page.evaluate(() => ({ alert: document.querySelector("[role='alert']")?.textContent, sourceRows: [...document.querySelectorAll(".source-row")].map((row) => row.textContent) }));
    throw new Error(`PDF upload did not complete successfully: ${JSON.stringify(state)}`);
  }
  const pdfSources = await authenticatedApi(token, `${apiUrl}/api/grounding/sources`);
  assert.equal(pdfSources.sources.length, 3);
  const pdfSource = pdfSources.sources.find((source) => source.sourceType === "pdf");
  assert(pdfSource && pdfSource.processingStatus === "processed");
  const pdfDetails = (await authenticatedApi(token, `${apiUrl}/api/grounding/sources/${pdfSource.id}`)).source;
  assert.deepEqual(pdfDetails.provenance.extraction.pages.map((item) => [item.pageNumber, item.hasText]), [[1, true], [2, false], [3, true]]);
  const pageChunks = await pool.query("SELECT metadata->>'pageNumber' AS page_number FROM grounding_chunks WHERE source_id=$1 ORDER BY chunk_order", [pdfSource.id]);
  assert.deepEqual(pageChunks.rows.map((row) => Number(row.page_number)), [1, 3]);

  const pdfSourceRow = page.locator(".source-row").filter({ hasText: "dbms-index-guide.pdf" });
  await pdfSourceRow.getByRole("link", { name: "Start learning session" }).click();
  await page.waitForURL(/\/study\/new\?sourceId=[0-9a-f-]+/i, { timeout: 10_000 });
  await page.getByRole("heading", { name: "Material to learn from" }).waitFor();
  assert((await page.locator(".source-study-preview").innerText()).includes("PDF page 1 · PDF page 3"), "The source handoff should show only pages with extracted text");
  await page.getByRole("button", { name: "Start learning session" }).click();
  await page.waitForURL(/\/study\/[0-9a-f-]+\?/i, { timeout: 20_000 });
  await page.getByRole("heading", { name: "Learning material" }).waitFor();
  await page.locator(".grid article").first().waitFor({ timeout: 10_000 });
  assert((await page.locator(".grid article").count()) > 0, "The source session should render at least one inspectable concept");
  assert((await page.locator(".source-study-preview").innerText()).includes("Extracted pages: 1, 3"), "The study session should preserve PDF page provenance");
  const sourceSessionId = new URL(page.url()).pathname.split("/").pop();
  const sourceSession = await authenticatedApi(token, `${apiUrl}/api/study-sessions/${sourceSessionId}`);
  assert.equal(sourceSession.session.groundingSourceId, pdfSource.id, "The study session must persist the selected source identity");
  assert.equal(sourceSession.session.rawMaterial, pdfDetails.content, "The study session must use the server-owned extracted source text");
  assert(sourceSession.concepts.length > 0, "The source session should extract inspectable concepts");
  const sourceEvidenceBeforeRecall = await pool.query("SELECT count(*)::int AS count FROM recall_attempts WHERE study_session_id=$1", [sourceSessionId]);
  assert.equal(sourceEvidenceBeforeRecall.rows[0].count, 0, "Opening extracted material must not create learner evidence");

  await page.goto(`${clientUrl}/resources`, { waitUntil: "domcontentloaded" });
  await page.getByText("Have material to study from?", { exact: true }).click();
  await page.locator("#material-type").selectOption("docx");
  const docxBuffer = await docxFixture();
  await page.locator("#material-file").setInputFiles({ name: "index-selection-notes.docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", buffer: docxBuffer });
  await page.getByRole("status").filter({ hasText: "index-selection-notes.docx" }).waitFor();
  await page.getByRole("button", { name: "Upload DOCX" }).click();
  await page.getByRole("status").filter({ hasText: "Extracted" }).waitFor({ timeout: 10_000 });
  const withDocx = await authenticatedApi(token, `${apiUrl}/api/grounding/sources`);
  const docxSource = withDocx.sources.find((source) => source.sourceType === "docx");
  assert(docxSource && docxSource.processingStatus === "processed", "Valid DOCX should persist as processed material");
  const docxDetails = (await authenticatedApi(token, `${apiUrl}/api/grounding/sources/${docxSource.id}`)).source;
  assert(docxDetails.content.includes("SQL | CREATE INDEX idx_orders_tenant"), "Extracted table data must be retained in source content");
  assert(docxDetails.provenance.extraction.paragraphCount >= 4 && docxDetails.provenance.extraction.sections.includes("Index selection"), "DOCX extraction should retain section and paragraph provenance");
  const docxChunks = await pool.query("SELECT metadata->>'section' AS section, metadata->>'paragraphStart' AS paragraph_start, metadata->>'paragraphEnd' AS paragraph_end FROM grounding_chunks WHERE source_id=$1 ORDER BY chunk_order", [docxSource.id]);
  assert(docxChunks.rows.some((row) => row.section === "Index selection" && Number(row.paragraph_start) > 0 && Number(row.paragraph_end) >= Number(row.paragraph_start)), "DOCX chunk references should identify section and source paragraphs");

  await page.locator("#material-type").selectOption("docx");
  await page.locator("#material-file").setInputFiles({ name: "broken.docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", buffer: await docxFixture({ malformed: true }) });
  await page.getByRole("button", { name: "Upload DOCX" }).click();
  await page.getByRole("alert").filter({ hasText: "not a valid DOCX" }).waitFor({ timeout: 10_000 });
  const afterInvalidDocx = await authenticatedApi(token, `${apiUrl}/api/grounding/sources`);
  assert(afterInvalidDocx.sources.some((source) => source.sourceType === "docx" && source.processingStatus === "failed" && source.title === "broken.docx"), "Invalid DOCX must be retained as a failed source, never marked ready");

  await page.locator("#material-type").selectOption("pdf");
  await page.locator("#material-file").setInputFiles({ name: "scanned.pdf", mimeType: "application/pdf", buffer: pdfFixture(["", ""]) });
  await page.getByRole("button", { name: "Upload PDF" }).click();
  await page.getByRole("alert").filter({ hasText: "No usable text could be extracted" }).waitFor({ timeout: 10_000 });
  const afterScanned = await authenticatedApi(token, `${apiUrl}/api/grounding/sources`);
  assert(afterScanned.sources.some((source) => source.processingStatus === "scanned_or_no_extractable_text"), "No-text PDFs must be persisted as unavailable, never ready");

  await page.locator("#material-type").selectOption("pdf");
  await page.locator("#material-file").setInputFiles({ name: "not-a-pdf.pdf", mimeType: "application/pdf", buffer: Buffer.from("This is not a PDF", "utf8") });
  await page.getByRole("button", { name: "Upload PDF" }).click();
  await page.getByRole("alert").filter({ hasText: "not a valid PDF" }).waitFor({ timeout: 10_000 });
  const afterMalformed = await authenticatedApi(token, `${apiUrl}/api/grounding/sources`);
  assert(afterMalformed.sources.some((source) => source.sourceType === "pdf" && source.processingStatus === "failed" && source.title === "not-a-pdf.pdf"), `Malformed PDF uploads must retain a truthful failed extraction status: ${JSON.stringify(afterMalformed.sources.map(({title,sourceType,processingStatus,processingError})=>({title,sourceType,processingStatus,processingError})))}`);

  await page.goto(`${clientUrl}/knowledge-check`, { waitUntil: "domcontentloaded" });
  await page.locator("#knowledge-subject").waitFor();
  const catalog = await authenticatedApi(token, `${apiUrl}/api/assessments/coverage`);
  const subject = catalog.subjects.find((item) => item.domainName === "Database Management Systems");
  const topic = subject?.topics.find((item) => item.name === "Indexes");
  const concept = topic?.concepts.find((item) => item.name === "Index selection" && item.supportedModes.includes("rapid_fire"));
  assert(subject && topic && concept, "The activated local DBMS Index selection blueprint must be available");
  await page.locator("#knowledge-subject").selectOption(subject.id);
  await page.locator("#knowledge-topic").selectOption(topic.id);
  await page.locator("label.concept-choice").filter({ hasText: "Index selection" }).locator("input").check();
  await page.locator("label.mode-choice").filter({ hasText: "Quick knowledge check" }).locator("input").check();
  await page.getByRole("button", { name: /Start knowledge check/ }).click();
  await page.waitForURL(/\/assessments\/[0-9a-f-]+/i, { timeout: 10_000 });
  const assessmentId = new URL(page.url()).pathname.split("/").pop();
  await page.getByRole("button", { name: /Start Rapid Fire/ }).click();
  await page.locator(".question-card").waitFor({ timeout: 10_000 });

  let assessment = await authenticatedApi(token, `${apiUrl}/api/assessments/${assessmentId}`);
  const originalAttemptIds = [];
  while (assessment.questions.some((question) => !question.submittedAt)) {
    const current = assessment.questions.find((question) => !question.submittedAt);
    assert(current, "An unanswered question should be available");
    originalAttemptIds.push(current.id);
    const expectedPrompt = current.questionData?.prompt ?? current.question;
    await page.waitForFunction((prompt) => document.querySelector(".question-prompt")?.textContent?.trim() === prompt.trim(), expectedPrompt, { timeout: 10_000 });
    const serializedQuestion = JSON.stringify(current.questionData ?? {});
    assert(!/correctOptionId|expectedAnswer|correctAnswer/i.test(serializedQuestion), "The browser-facing assessment must not expose answer keys before submission");
    if (current.questionType === "mcq") {
      const answerKey = (await pool.query("SELECT correct_option_id FROM canonical_question_revisions WHERE id=$1", [current.canonicalQuestionRevisionId])).rows[0]?.correct_option_id;
      const wrong = current.questionData.options.find((option) => option.id !== answerKey);
      assert(wrong, "The MCQ must contain a defensibly incorrect distractor");
      await page.locator("label.option").filter({ hasText: wrong.text }).locator("input").check();
    } else if (current.questionData?.parts?.length) {
      for (const part of current.questionData.parts) await page.locator(`#assessment-answer-${part.id}`).fill("I do not know this yet.");
    } else {
      await page.locator("#assessment-answer").fill("I do not know this yet.");
    }
    const submitAnswer = page.getByRole("button", { name: /Submit answer/ });
    try { await page.waitForFunction(() => document.querySelector("form.question-card button[type='submit']")?.disabled === false, null, { timeout: 3000 }); }
    catch {
      const formState = await page.evaluate(() => ({ prompt: document.querySelector(".question-prompt")?.textContent, inputs: [...document.querySelectorAll("form.question-card input, form.question-card textarea")].map((input) => ({ id: input.id, type: input.type, checked: input.checked, value: input.value })), submitDisabled: document.querySelector("form.question-card button[type='submit']")?.disabled }));
      throw new Error(`The learner answer did not enable submit (type=${current.questionType}, parts=${current.questionData?.parts?.length ?? 0}): ${JSON.stringify(formState)}`);
    }
    await submitAnswer.click();
    assessment = await waitForAssessment(token, apiUrl, assessmentId, (value) => value.questions.find((question) => question.id === current.id)?.submittedAt);
  }
  await page.locator(".report-hero").waitFor({ timeout: 10_000 });
  assert(assessment.questions.every((question) => question.submittedAt && question.evaluation), "Every assessment answer must be evaluated and persisted");
  assert(assessment.questions.some((question) => question.resultStatus === "incorrect" || question.resultStatus === "partial"), "The deliberate weak responses must produce a real diagnosed gap");
  const trigger = assessment.questions.find((question) => question.resultStatus === "incorrect" || question.resultStatus === "partial");
  assert(trigger, "A weak attempt is required for the remediation path");

  let remediation = null;
  let finalRemediation = null;
  let verificationId = null;
  const recommendation = assessment.result?.recommendation;
  assert(recommendation && recommendation.actionType !== "none", "The report should provide its evidence-backed next action");
  if (recommendation.actionType === "remediation") {
  await page.getByRole("button", { name: "Open focused review" }).click();
  await page.waitForURL(/\/remediations\/[0-9a-f-]+$/i, { timeout: 10_000 });
  const remediationId = new URL(page.url()).pathname.split("/").pop();
  remediation = (await authenticatedApi(token, `${apiUrl}/api/remediations/${remediationId}`)).remediation;
  assert.equal(remediation.status, "ready");
  assert(originalAttemptIds.includes(remediation.triggeringAttemptId), "The browser recommendation must create remediation from its persisted assessment attempt");
  assert(assessment.questions.find((question) => question.id === remediation.triggeringAttemptId)?.submittedAt, "Remediation must be grounded in a submitted assessment answer");
  assert(remediation.sources.length > 0, "Remediation must be grounded in the learner's persisted source");
  const pdfPassage = remediation.sources.find((source) => source.sourceType === "pdf");
  assert(pdfPassage && [1, 3].includes(Number(pdfPassage.pageNumber)), "A PDF-grounded remediation excerpt must retain its original one-based page reference");
  const docxPassage = remediation.sources.find((source) => source.sourceType === "docx");
  assert(docxPassage && docxPassage.section === "Index selection" && Number(docxPassage.paragraphStart) > 0, "Grounded DOCX remediation must retain section and paragraph citations");
  await page.goto(`${clientUrl}/remediations/${remediation.id}`, { waitUntil: "domcontentloaded" });
  await page.locator(".remediation-explanation").waitFor({ timeout: 10_000 });
  await page.getByRole("button", { name: /Check what you remember/ }).click();
  await page.waitForURL(/\/recall\/[0-9a-f-]+$/i, { timeout: 10_000 });
  verificationId = new URL(page.url()).pathname.split("/").pop();
  const verification = await authenticatedApi(token, `${apiUrl}/api/recalls/${verificationId}`);
  const verificationAttempt = verification.attempt ?? verification.recall ?? verification;
  assert(!originalAttemptIds.includes(verificationAttempt.id), "Verification must create a distinct learner attempt");
  assert(verificationAttempt.canonicalQuestionRevisionId && !assessment.questions.some((question) => question.canonicalQuestionRevisionId === verificationAttempt.canonicalQuestionRevisionId), "Verification must use a distinct immutable question revision");
  if (verificationAttempt.questionType === "mcq") {
    const answerKey = (await pool.query("SELECT correct_option_id FROM canonical_question_revisions WHERE id=$1", [verificationAttempt.canonicalQuestionRevisionId])).rows[0]?.correct_option_id;
    const choice = verificationAttempt.questionData.options.find((option) => option.id === answerKey);
    await page.locator("label.option").filter({ hasText: choice.text }).click();
  } else {
    const revision = (await pool.query("SELECT expected_answer FROM canonical_question_revisions WHERE id=$1", [verificationAttempt.canonicalQuestionRevisionId])).rows[0];
    await page.locator("#answer").fill(revision?.expected_answer ?? remediation.knowledgePoint);
  }
  await page.getByRole("button", { name: /Submit recall/ }).click();
  await page.waitForURL(new RegExp(`/recall/${verificationId}/result`), { timeout: 10_000 });
  finalRemediation = (await authenticatedApi(token, `${apiUrl}/api/remediations/${remediation.id}`)).remediation;
  assert.equal(finalRemediation.status, "verified");
  assert.equal(finalRemediation.improved, true, "The distinct verification answer should improve persisted evidence");
  } else if (recommendation.actionType === "learn") {
    assert.match(recommendation.reason, /not have enough unseen questions/i, "The resource fallback should explain that distinct eligible coverage is unavailable");
    await page.getByRole("button", { name: "Open focused resources" }).click();
    await page.waitForURL(/\/resources\?conceptId=/, { timeout: 10_000 });
    assert.equal(new URL(page.url()).searchParams.get("conceptId"), assessment.assessment.conceptId, "The recommendation should preserve the assessed concept");
  } else {
    assert.fail(`Expected remediation or honest coverage fallback, got ${recommendation.actionType}`);
  }

  await page.goto(`${clientUrl}/readiness?goalId=${goalId}`, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "My Readiness" }).waitFor();
  await page.getByText(/knowledge points have submitted evidence/).waitFor({ timeout: 10_000 });
  const readiness = await authenticatedApi(token, `${apiUrl}/api/goals/${goalId}/readiness`);
  const dbmsSkill = readiness.skills.find((skill) => skill.name === "Databases");
  assert(dbmsSkill?.assessedPoints > 0 && dbmsSkill.unassessedPoints > 0, "Readiness must show persisted assessed evidence while leaving other DBMS points unassessed");
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByText(/knowledge points have submitted evidence/).waitFor({ timeout: 10_000 });

  await page.goto(`${clientUrl}/plan/today?goalId=${goalId}`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Build my plan" }).click();
  await page.locator(".journey-step").first().waitFor({ timeout: 10_000 });
  let plan = await authenticatedApi(token, `${apiUrl}/api/plan/today`);
  assert(plan.tasks.length > 0, "The plan UI should persist tasks for the selected goal");
  const firstTaskId = plan.tasks[0].id;
  const firstTaskCard = page.locator(`.journey-card[data-task-id="${firstTaskId}"]`);
  await firstTaskCard.getByRole("button", { name: "Keep for later today" }).click();
  await firstTaskCard.getByText("In progress", { exact: true }).waitFor({ timeout: 10_000 });
  plan = await authenticatedApi(token, `${apiUrl}/api/plan/today`);
  assert.equal(plan.tasks.find((task) => task.id === firstTaskId)?.status, "in_progress", "Keep for later should persist the in-progress state");
  await firstTaskCard.getByRole("button", { name: "Skip today" }).click();
  await firstTaskCard.getByText("Skipped for today", { exact: true }).waitFor({ timeout: 10_000 });
  plan = await authenticatedApi(token, `${apiUrl}/api/plan/today`);
  assert.equal(plan.tasks.find((task) => task.id === firstTaskId)?.status, "missed", "Skip today should persist a skipped state");
  await page.reload({ waitUntil: "domcontentloaded" });
  const restoredTaskCard = page.locator(`.journey-card[data-task-id="${firstTaskId}"]`);
  await restoredTaskCard.getByRole("button", { name: "Put back in today’s plan" }).click();
  await restoredTaskCard.getByRole("button", { name: "Mark complete" }).waitFor({ timeout: 10_000 });
  plan = await authenticatedApi(token, `${apiUrl}/api/plan/today`);
  assert.equal(plan.tasks.find((task) => task.id === firstTaskId)?.status, "planned", "Restoring a skipped task should persist across reload");
  if (plan.tasks.length > 1) {
    const secondTaskId = plan.tasks[1].id;
    const secondTaskCard = page.locator(`.journey-card[data-task-id="${secondTaskId}"]`);
    await secondTaskCard.getByRole("button", { name: "Mark complete" }).click();
    await secondTaskCard.getByText("Completed", { exact: true }).waitFor({ timeout: 10_000 });
    plan = await authenticatedApi(token, `${apiUrl}/api/plan/today`);
    assert.equal(plan.tasks.find((task) => task.id === secondTaskId)?.status, "completed", "Mark complete should persist the completed state");
  }
  await page.goto(`${clientUrl}/review`, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "Choose what to strengthen" }).waitFor();
  await page.getByRole("heading", { name: "Concepts to improve" }).waitFor({ timeout: 10_000 });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "Choose what to strengthen" }).waitFor();

  // Baseline uses its own disposable learner so this branch cannot inherit the
  // main journey's question history or make question availability look exhausted.
  const baselineEmail = `e2e-core-baseline-${Date.now()}-${Math.random().toString(16).slice(2)}@test.local`;
  const baselinePassword = `Pilot-${Math.random().toString(36).slice(2)}-${Date.now()}`;
  ownedEmails.push(baselineEmail);
  const baselineContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const baselinePage = await baselineContext.newPage();
  baselinePage.on("pageerror", (error) => browserJavaScriptErrors.push(error.message));
  baselinePage.on("requestfailed", (request) => {
    const failureText = request.failure()?.errorText ?? "request failed";
    if (isExpectedCanceledRequest(request.method(), request.url(), failureText, new URL(clientUrl).origin)) expectedCanceledRequests.push(`${request.method()} ${request.url()}: ${failureText}`);
    else unexpectedFailedRequests.push(`${request.method()} ${request.url()}: ${failureText}`);
  });
  await baselinePage.route("https://fonts.googleapis.com/**", (route) => route.fulfill({ status: 200, contentType: "text/css", body: "" }));
  await baselinePage.route("https://fonts.gstatic.com/**", (route) => route.fulfill({ status: 204, body: "" }));
  await baselinePage.goto(`${clientUrl}/register`, { waitUntil: "domcontentloaded" });
  await baselinePage.locator("#name").fill("RecallLoop Baseline Pilot");
  await baselinePage.locator("#email").fill(baselineEmail);
  await baselinePage.locator("#password").fill(baselinePassword);
  await baselinePage.getByRole("button", { name: "Create account" }).click();
  await baselinePage.waitForURL("**/onboarding", { timeout: 10_000 });
  await baselinePage.getByRole("button", { name: "Studied before" }).click();
  await baselinePage.locator("#start-topic").selectOption({ label: "Databases" });
  await baselinePage.getByRole("button", { name: "Continue to starting check" }).click();
  await baselinePage.waitForURL(/\/baseline\/[0-9a-f-]+$/i, { timeout: 10_000 });
  const baselineId = new URL(baselinePage.url()).pathname.split("/").pop();
  const baselineToken = await baselinePage.evaluate(() => localStorage.getItem("recallloop_token"));
  assert(baselineToken, "Baseline learner registration should establish an authenticated session");
  const baselineUser = (await pool.query("SELECT id FROM app_users WHERE email=$1", [baselineEmail])).rows[0];
  assert(baselineUser, "The baseline learner must be an isolated persisted test account");
  const startingAssessment = await authenticatedApi(baselineToken, `${apiUrl}/api/baseline/${baselineId}`);
  assert.equal(startingAssessment.baseline.assessment.status, "pending");
  assert.equal(startingAssessment.baseline.questions.length, 4, "Familiar starting level should use the supported four-question baseline");
  const baselineQuestionPoints = await pool.query("SELECT bq.id, kp.statement FROM baseline_questions bq JOIN knowledge_points kp ON kp.id=bq.knowledge_point_id WHERE bq.assessment_id=$1 ORDER BY bq.id", [baselineId]);
  assert.equal(baselineQuestionPoints.rowCount, 4);
  const baselineOutcomes = [];
  for (let index = 0; index < baselineQuestionPoints.rows.length; index += 1) {
    const item = baselineQuestionPoints.rows[index];
    const baselineAnswer = index === 1 ? partialBaselineAnswer(item.statement) : index === 2 ? "I cannot recall this concept yet." : item.statement;
    assert(baselineAnswer.trim(), `Baseline question ${item.id} must have a non-empty point statement`);
    await baselinePage.locator("#baseline-answer").click();
    await baselinePage.locator("#baseline-answer").press("Control+A");
    await baselinePage.locator("#baseline-answer").pressSequentially(baselineAnswer, { delay: 1 });
    await baselinePage.waitForFunction(() => document.querySelector("#baseline-answer")?.value.trim().length > 0 && document.querySelector("form.question-card button")?.disabled === false, null, { timeout: 5_000 }).catch(async (error) => {
      console.error(`Baseline form did not enable submit: ${JSON.stringify({ url: baselinePage.url(), answer: await baselinePage.locator("#baseline-answer").inputValue().catch(() => null), disabled: await baselinePage.locator("form.question-card button").isDisabled().catch(() => null), prompt: await baselinePage.locator(".question-prompt").innerText().catch(() => null), body: (await baselinePage.locator("body").innerText().catch(() => "")).slice(-1200), expectedAnswerLength: baselineAnswer.length })}`);
      throw error;
    });
    await baselinePage.getByRole("button", { name: "Continue" }).click();
    if (index < baselineQuestionPoints.rows.length - 1) await baselinePage.locator("#baseline-answer").waitFor({ timeout: 10_000 });
  }
  await baselinePage.waitForURL(new RegExp(`/baseline/${baselineId}/result$`), { timeout: 10_000 });
  await baselinePage.getByRole("heading", { name: "Your learning starts here" }).waitFor();
  const baselineResult = await authenticatedApi(baselineToken, `${apiUrl}/api/baseline/${baselineId}`);
  assert.equal(baselineResult.baseline.assessment.status, "completed");
  assert(baselineResult.baseline.questions.every((question) => question.submittedAt && question.answer), "Every baseline answer should be evaluated and persisted");
  const persistedBaselineStates = await pool.query("SELECT DISTINCT result->>'status' AS status FROM baseline_questions bq CROSS JOIN LATERAL jsonb_array_elements(bq.knowledge_point_results) result WHERE bq.assessment_id=$1 ORDER BY status", [baselineId]);
  const observedBaselineStatuses = persistedBaselineStates.rows.map((row) => row.status);
  assert(observedBaselineStatuses.includes("correct") && observedBaselineStatuses.includes("partial") && observedBaselineStatuses.includes("missing"), `Baseline should persist correct, partial and incorrect evidence; got ${observedBaselineStatuses.join(", ")}`);
  assert(baselineResult.baseline.assessment.observedMastery !== null, "A completed answered baseline should persist an observed starting point");
  assert.equal((await pool.query("SELECT count(*)::int AS count FROM learner_knowledge_states WHERE user_id=$1 AND baseline_source='assessed'", [baselineUser.id])).rows[0].count, 4, "Baseline learner state should contain the four assessed concepts");
  await baselinePage.getByRole("link", { name: "Start a study session" }).waitFor();
  await baselinePage.reload({ waitUntil: "domcontentloaded" });
  await baselinePage.getByRole("heading", { name: "Your learning starts here" }).waitFor();
  assert.equal((await authenticatedApi(baselineToken, `${apiUrl}/api/baseline/${baselineId}`)).baseline.assessment.status, "completed", "Completed starting-point evidence should survive reload");
  const baselineGoal = (await pool.query("SELECT goal_id FROM baseline_assessments WHERE id=$1", [baselineId])).rows[0];
  const baselineReadiness = await authenticatedApi(baselineToken, `${apiUrl}/api/goals/${baselineGoal.goal_id}/readiness`);
  const baselineSkillReadiness = baselineReadiness.skills.find((skill) => skill.name === "Databases");
  assert(baselineSkillReadiness?.assessedPoints > 0, "Submitted baseline point evidence must contribute to canonical goal readiness");
  await baselinePage.goto(`${clientUrl}/readiness?goalId=${baselineGoal.goal_id}`, { waitUntil: "domcontentloaded" });
  await baselinePage.locator(".readiness-skill").filter({ hasText: "Databases" }).getByText(/knowledge points have submitted evidence/).waitFor({ timeout: 10_000 });
  await baselinePage.reload({ waitUntil: "domcontentloaded" });
  await baselinePage.locator(".readiness-skill").filter({ hasText: "Databases" }).getByText(/knowledge points have submitted evidence/).waitFor({ timeout: 10_000 });
  await baselineContext.close();

  // Authentication lifecycle and dashboard destinations use a separate account.
  const authEmail = `e2e-core-auth-${Date.now()}-${Math.random().toString(16).slice(2)}@test.local`;
  const authPassword = `Pilot-${Math.random().toString(36).slice(2)}-${Date.now()}`;
  ownedEmails.push(authEmail);
  const authContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const authPage = await authContext.newPage();
  authPage.on("pageerror", (error) => browserJavaScriptErrors.push(error.message));
  authPage.on("requestfailed", (request) => {
    const failureText = request.failure()?.errorText ?? "request failed";
    if (isExpectedCanceledRequest(request.method(), request.url(), failureText, new URL(clientUrl).origin)) expectedCanceledRequests.push(`${request.method()} ${request.url()}: ${failureText}`);
    else unexpectedFailedRequests.push(`${request.method()} ${request.url()}: ${failureText}`);
  });
  await authPage.route("https://fonts.googleapis.com/**", (route) => route.fulfill({ status: 200, contentType: "text/css", body: "" }));
  await authPage.route("https://fonts.gstatic.com/**", (route) => route.fulfill({ status: 204, body: "" }));
  await authPage.goto(`${clientUrl}/register`, { waitUntil: "domcontentloaded" });
  await authPage.locator("#name").fill("RecallLoop Authentication Pilot");
  await authPage.locator("#email").fill(authEmail);
  await authPage.locator("#password").fill(authPassword);
  await authPage.getByRole("button", { name: "Create account" }).click();
  await authPage.waitForURL("**/onboarding", { timeout: 10_000 });
  await authPage.locator("#start-topic").selectOption({ label: "Databases" });
  await authPage.getByRole("button", { name: "Start studying" }).click();
  await authPage.waitForURL(/\/study\/new\?topic=/, { timeout: 10_000 });
  const authGoalId = new URL(authPage.url()).searchParams.get("goalId");
  assert(authGoalId, "The authentication account should retain its onboarding goal");
  await authPage.getByRole("button", { name: "Sign out" }).click();
  await authPage.waitForURL("**/login", { timeout: 10_000 });
  assert.equal(await authPage.evaluate(() => localStorage.getItem("recallloop_token")), null, "Sign out must remove the local token");
  await authPage.goto(`${clientUrl}/readiness`, { waitUntil: "domcontentloaded" });
  await authPage.waitForURL("**/login", { timeout: 10_000 });
  await authPage.locator("#email").fill(authEmail);
  await authPage.locator("#password").fill("Incorrect-password-123");
  await authPage.getByRole("button", { name: "Sign in" }).click();
  await authPage.getByText(/invalid email or password/i).waitFor({ timeout: 5000 });
  assert.equal(await authPage.evaluate(() => localStorage.getItem("recallloop_token")), null, "Invalid credentials must not establish a session");
  await authPage.locator("#password").fill(authPassword);
  await authPage.getByRole("button", { name: "Sign in" }).click();
  await authPage.waitForURL("**/dashboard", { timeout: 10_000 });
  const restoredAuthToken = await authPage.evaluate(() => localStorage.getItem("recallloop_token"));
  assert(restoredAuthToken && (await authenticatedApi(restoredAuthToken, `${apiUrl}/api/goals`)).goals.some((item) => item.id === authGoalId), "Login should restore the same learner and existing goal");
  await authPage.reload({ waitUntil: "domcontentloaded" });
  await authPage.getByRole("heading", { name: /Choose your next learning step|What would you like to do/ }).waitFor();
  assert.equal(await authPage.evaluate(() => localStorage.getItem("recallloop_token")), restoredAuthToken, "Authenticated session should restore after reload");

  await authPage.getByRole("link", { name: "Choose a knowledge check" }).click();
  await authPage.waitForURL("**/knowledge-check", { timeout: 10_000 });
  await authPage.getByRole("heading", { name: "What would you like to check?" }).waitFor();
  await authPage.goto(`${clientUrl}/dashboard`, { waitUntil: "domcontentloaded" });
  await authPage.getByRole("link", { name: "Choose a topic or add notes" }).click();
  await authPage.waitForURL("**/study/new", { timeout: 10_000 });
  await authPage.getByRole("heading", { name: "What would you like to learn?" }).waitFor();
  await authPage.goto(`${clientUrl}/dashboard`, { waitUntil: "domcontentloaded" });
  await authPage.getByRole("link", { name: "Choose what to strengthen" }).click();
  await authPage.waitForURL("**/review", { timeout: 10_000 });
  await authPage.getByRole("heading", { name: "Choose what to strengthen" }).waitFor();
  await authPage.goto(`${clientUrl}/study/new`, { waitUntil: "domcontentloaded" });
  await authPage.locator("#study-topic").fill("Dashboard continuation study");
  await authPage.locator("#material").fill("A dashboard continuation should reopen the learner's own unfinished study session.");
  await authPage.getByRole("button", { name: "Create study session" }).click();
  await authPage.waitForURL(/\/study\/[0-9a-f-]+\?/i, { timeout: 10_000 });
  const continuationSessionId = new URL(authPage.url()).pathname.split("/").pop();
  const dashboardDestinations = [
    ["Goals", "**/goals", "Goals"],
    ["My Readiness", "**/readiness", "My Readiness"],
    ["Today's plan", "**/plan/today", "A learning journey for today"],
    ["Knowledge", "**/knowledge", "Knowledge map"],
    ["Resources", "**/resources", "Learning resources"],
    ["Learner", "**/learner", "What do you actually know?"],
    ["Settings", "**/settings", "Settings"],
  ];
  for (const [label, urlPattern, heading] of dashboardDestinations) {
    await authPage.getByRole("link", { name: label, exact: true }).click();
    await authPage.waitForURL(urlPattern, { timeout: 10_000 });
    await authPage.getByRole("heading", { name: heading, exact: true }).waitFor({ timeout: 10_000 });
    await authPage.goBack({ waitUntil: "domcontentloaded" });
    await authPage.getByRole("heading", { name: "Dashboard continuation study", exact: true }).waitFor({ timeout: 10_000 });
  }
  await authPage.goto(`${clientUrl}/dashboard`, { waitUntil: "domcontentloaded" });
  await authPage.getByRole("heading", { name: "Dashboard continuation study", exact: true }).waitFor({ timeout: 10_000 });
  const continuationLink = authPage.locator(".home-continuation a");
  assert.equal(await continuationLink.count(), 1, "An unfinished study should expose one dashboard continuation action");
  const continuationPath = await continuationLink.getAttribute("href");
  assert(continuationPath?.includes(continuationSessionId), "The dashboard continuation should identify this learner's unfinished session");
  await continuationLink.click();
  await authPage.waitForURL((url) => `${url.pathname}${url.search}${url.hash}` === continuationPath, { timeout: 10_000 });
  await authPage.getByRole("heading", { name: "Dashboard continuation study", exact: true }).waitFor();
  await authPage.goBack({ waitUntil: "domcontentloaded" });
  await authPage.locator(".home-context-strip").getByRole("link", { name: "View details" }).click();
  await authPage.waitForURL(`**/goals/${authGoalId}`, { timeout: 10_000 });
  await authPage.getByRole("heading", { name: "Backend Engineer", exact: true }).waitFor();
  await authContext.close();

  // Due-review journey: create real pending work, make only this isolated
  // learner's persisted schedule due, then submit through Review & Improve.
  const reviewEmail = `e2e-core-review-${Date.now()}-${Math.random().toString(16).slice(2)}@test.local`;
  const reviewPassword = `Pilot-${Math.random().toString(36).slice(2)}-${Date.now()}`;
  ownedEmails.push(reviewEmail);
  const reviewContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const reviewPage = await reviewContext.newPage();
  reviewPage.on("pageerror", (error) => browserJavaScriptErrors.push(error.message));
  reviewPage.on("requestfailed", (request) => {
    const failureText = request.failure()?.errorText ?? "request failed";
    if (isExpectedCanceledRequest(request.method(), request.url(), failureText, new URL(clientUrl).origin)) expectedCanceledRequests.push(`${request.method()} ${request.url()}: ${failureText}`);
    else unexpectedFailedRequests.push(`${request.method()} ${request.url()}: ${failureText}`);
  });
  await reviewPage.route("https://fonts.googleapis.com/**", (route) => route.fulfill({ status: 200, contentType: "text/css", body: "" }));
  await reviewPage.route("https://fonts.gstatic.com/**", (route) => route.fulfill({ status: 204, body: "" }));
  await reviewPage.goto(`${clientUrl}/register`, { waitUntil: "domcontentloaded" });
  await reviewPage.locator("#name").fill("RecallLoop Due Review Pilot");
  await reviewPage.locator("#email").fill(reviewEmail);
  await reviewPage.locator("#password").fill(reviewPassword);
  await reviewPage.getByRole("button", { name: "Create account" }).click();
  await reviewPage.waitForURL("**/onboarding", { timeout: 10_000 });
  await reviewPage.locator("#start-topic").selectOption({ label: "Databases" });
  await reviewPage.getByRole("button", { name: "Start studying" }).click();
  await reviewPage.waitForURL(/\/study\/new\?topic=/, { timeout: 10_000 });
  const reviewToken = await reviewPage.evaluate(() => localStorage.getItem("recallloop_token"));
  const reviewUser = (await pool.query("SELECT id FROM app_users WHERE email=$1", [reviewEmail])).rows[0];
  assert(reviewToken && reviewUser, "Due-review learner must be separately registered and persisted");
  await reviewPage.goto(`${clientUrl}/knowledge-check`, { waitUntil: "domcontentloaded" });
  const reviewCoverage = await authenticatedApi(reviewToken, `${apiUrl}/api/assessments/coverage`);
  const reviewSubject = reviewCoverage.subjects.find((item) => item.domainName === "Database Management Systems");
  const reviewTopic = reviewSubject?.topics.find((item) => item.name === "Indexes");
  const reviewConcept = reviewTopic?.concepts.find((item) => item.name === "Index selection" && item.supportedModes.includes("rapid_fire"));
  assert(reviewSubject && reviewTopic && reviewConcept, "Due-review fixture must use actual eligible DBMS questions");
  await reviewPage.locator("#knowledge-subject").selectOption(reviewSubject.id);
  await reviewPage.locator("#knowledge-topic").selectOption(reviewTopic.id);
  await reviewPage.locator("label.concept-choice").filter({ hasText: "Index selection" }).locator("input").check();
  await reviewPage.locator("label.mode-choice").filter({ hasText: "Quick knowledge check" }).locator("input").check();
  await reviewPage.getByRole("button", { name: /Start knowledge check/ }).click();
  await reviewPage.waitForURL(/\/assessments\/[0-9a-f-]+/i, { timeout: 10_000 });
  const reviewAssessmentId = new URL(reviewPage.url()).pathname.split("/").pop();
  await reviewPage.getByRole("button", { name: /Start Rapid Fire/ }).click();
  const reviewAssessment = await authenticatedApi(reviewToken, `${apiUrl}/api/assessments/${reviewAssessmentId}`);
  const firstReviewQuestion = reviewAssessment.questions[0];
  assert(firstReviewQuestion && !firstReviewQuestion.submittedAt, "Assessment creation should persist pending review candidates");
  await reviewPage.waitForFunction((prompt) => document.querySelector(".question-prompt")?.textContent?.trim() === prompt.trim(), firstReviewQuestion.questionData?.prompt ?? firstReviewQuestion.question, { timeout: 10_000 });
  if (firstReviewQuestion.questionType === "mcq") {
    const key = (await pool.query("SELECT correct_option_id FROM canonical_question_revisions WHERE id=$1", [firstReviewQuestion.canonicalQuestionRevisionId])).rows[0].correct_option_id;
    const wrongOption = firstReviewQuestion.questionData.options.find((option) => option.id !== key);
    await reviewPage.locator("label.option").filter({ hasText: wrongOption.text }).locator("input").check();
  } else {
    await reviewPage.locator("#assessment-answer").fill("I cannot recall this competency yet.");
  }
  await reviewPage.getByRole("button", { name: /Submit answer/ }).click();
  const savedFirstQuestion = await waitForAssessment(reviewToken, apiUrl, reviewAssessmentId, (value) => value.questions.find((question) => question.id === firstReviewQuestion.id)?.submittedAt);
  const submittedRecall = savedFirstQuestion.questions.find((question) => question.id === firstReviewQuestion.id);
  assert(submittedRecall?.submittedAt, "The historical assessment answer should be submitted before preparing due work");
  const historicalSnapshot = (await pool.query("SELECT answer, submitted_at, canonical_question_revision_id FROM recall_attempts WHERE id=$1 AND user_id=$2", [submittedRecall.id, reviewUser.id])).rows[0];
  const reviewStateBefore = (await pool.query("SELECT concept_id, due_at, interval_days FROM review_states WHERE user_id=$1 AND concept_id=(SELECT concept_id FROM recall_attempts WHERE id=$2)", [reviewUser.id, submittedRecall.id])).rows[0];
  assert(reviewStateBefore, "A submitted historical attempt should create the authoritative review_states record");
  const duePrepared = await pool.query("UPDATE review_states SET due_at=now()-interval '1 minute', updated_at=now() WHERE user_id=$1 AND concept_id=$2 RETURNING due_at, interval_days", [reviewUser.id, reviewStateBefore.concept_id]);
  assert.equal(duePrepared.rowCount, 1, "Only the isolated learner's schedule should be prepared as due");
  const pendingDue = await pool.query("SELECT id FROM recall_attempts WHERE user_id=$1 AND concept_id=$2 AND submitted_at IS NULL ORDER BY created_at,id LIMIT 1", [reviewUser.id, reviewStateBefore.concept_id]);
  assert(pendingDue.rows[0], "The due review requires a genuinely pending recall attempt");
  const pendingDueId = pendingDue.rows[0].id;
  const dueDashboard = await authenticatedApi(reviewToken, `${apiUrl}/api/dashboard`);
  assert(dueDashboard.todayDue.some((item) => item.recallId === pendingDueId), "Persisted due schedule should expose the pending recall to Review & Improve");
  await reviewPage.goto(`${clientUrl}/dashboard`, { waitUntil: "domcontentloaded" });
  await reviewPage.getByRole("link", { name: "Choose what to strengthen" }).click();
  await reviewPage.waitForURL("**/review", { timeout: 10_000 });
  const pendingReviewLink = reviewPage.locator(`a[href^="/recall/${pendingDueId}"]`);
  await pendingReviewLink.click();
  await reviewPage.waitForURL(new RegExp(`/recall/${pendingDueId}(?:\\?|$)`), { timeout: 10_000 });
  const reviewAttempt = (await authenticatedApi(reviewToken, `${apiUrl}/api/recalls/${pendingDueId}`)).recall;
  assert.equal(reviewAttempt.submittedAt, null, "The due recall should remain pending until the learner submits it");
  if (reviewAttempt.questionType === "mcq") {
    const key = (await pool.query("SELECT correct_option_id FROM canonical_question_revisions WHERE id=$1", [reviewAttempt.canonicalQuestionRevisionId])).rows[0].correct_option_id;
    const correct = reviewAttempt.questionData.options.find((option) => option.id === key);
    await reviewPage.locator("label.option").filter({ hasText: correct.text }).locator("input").check();
  } else {
    const expected = (await pool.query("SELECT expected_answer FROM canonical_question_revisions WHERE id=$1", [reviewAttempt.canonicalQuestionRevisionId])).rows[0]?.expected_answer;
    await reviewPage.locator("#answer").fill(expected ?? reviewAttempt.knowledgePoint);
  }
  await reviewPage.getByRole("button", { name: /Submit recall/ }).click();
  await reviewPage.waitForURL(new RegExp(`/recall/${pendingDueId}/result`), { timeout: 10_000 });
  const submittedReview = (await authenticatedApi(reviewToken, `${apiUrl}/api/recalls/${pendingDueId}`)).recall;
  assert(submittedReview.submittedAt && submittedReview.evaluation, "Due-review answer should persist its evaluation");
  const reviewStateAfter = (await pool.query("SELECT due_at, interval_days, last_outcome FROM review_states WHERE user_id=$1 AND concept_id=$2", [reviewUser.id, reviewStateBefore.concept_id])).rows[0];
  assert(new Date(reviewStateAfter.due_at).getTime() > new Date(duePrepared.rows[0].due_at).getTime(), "Successful review submission should advance the persisted due timestamp");
  assert(Number(reviewStateAfter.interval_days) > 0 && reviewStateAfter.last_outcome, "Scheduler interval and outcome should persist with the review");
  const historicalAfter = (await pool.query("SELECT answer, submitted_at, canonical_question_revision_id FROM recall_attempts WHERE id=$1 AND user_id=$2", [submittedRecall.id, reviewUser.id])).rows[0];
  assert.deepEqual(historicalAfter, historicalSnapshot, "Submitting due review must not overwrite the earlier historical attempt");
  assert.equal((await authenticatedApi(reviewToken, `${apiUrl}/api/dashboard`)).todayDue.some((item) => item.recallId === pendingDueId), false, "Completed due work should no longer appear outstanding");
  await reviewPage.goto(`${clientUrl}/review`, { waitUntil: "domcontentloaded" });
  await reviewPage.reload({ waitUntil: "domcontentloaded" });
  assert.equal((await authenticatedApi(reviewToken, `${apiUrl}/api/dashboard`)).todayDue.some((item) => item.recallId === pendingDueId), false, "Due-review completion should survive page reload");
  await reviewContext.close();

  async function runNonCorrectDueReview(expectedOutcome) {
    const dueEmail = `e2e-core-review-${expectedOutcome}-${Date.now()}-${Math.random().toString(16).slice(2)}@test.local`;
    const duePassword = `Pilot-${Math.random().toString(36).slice(2)}-${Date.now()}`;
    ownedEmails.push(dueEmail);
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const duePage = await context.newPage();
    duePage.on("pageerror", (error) => browserJavaScriptErrors.push(error.message));
    duePage.on("requestfailed", (request) => {
      const failureText = request.failure()?.errorText ?? "request failed";
      if (isExpectedCanceledRequest(request.method(), request.url(), failureText, new URL(clientUrl).origin)) expectedCanceledRequests.push(`${request.method()} ${request.url()}: ${failureText}`);
      else unexpectedFailedRequests.push(`${request.method()} ${request.url()}: ${failureText}`);
    });
    await duePage.route("https://fonts.googleapis.com/**", (route) => route.fulfill({ status: 200, contentType: "text/css", body: "" }));
    await duePage.route("https://fonts.gstatic.com/**", (route) => route.fulfill({ status: 204, body: "" }));
    try {
      await duePage.goto(`${clientUrl}/register`, { waitUntil: "domcontentloaded" });
      await duePage.locator("#name").fill(`RecallLoop ${expectedOutcome} due review`);
      await duePage.locator("#email").fill(dueEmail);
      await duePage.locator("#password").fill(duePassword);
      await duePage.getByRole("button", { name: "Create account" }).click();
      await duePage.waitForURL("**/onboarding", { timeout: 10_000 });
      await duePage.locator("#start-topic").selectOption({ label: "Databases" });
      await duePage.getByRole("button", { name: "Start studying" }).click();
      await duePage.waitForURL(/\/study\/new\?topic=/, { timeout: 10_000 });
      const token = await duePage.evaluate(() => localStorage.getItem("recallloop_token"));
      const owner = (await pool.query("SELECT id FROM app_users WHERE email=$1", [dueEmail])).rows[0];
      assert(token && owner, `${expectedOutcome} due-review learner should be authenticated and persisted`);
      const coverage = await authenticatedApi(token, `${apiUrl}/api/assessments/coverage`);
      const subject = coverage.subjects.find((item) => item.domainName === "Database Management Systems");
      const topic = subject?.topics.find((item) => item.name === "Indexes");
      const concept = topic?.concepts.find((item) => item.name === "Index selection" && item.supportedModes.includes("rapid_fire"));
      assert(subject && topic && concept, "Due-review fixture must use an eligible real blueprint");
      await duePage.goto(`${clientUrl}/knowledge-check`, { waitUntil: "domcontentloaded" });
      await duePage.locator("#knowledge-subject").selectOption(subject.id);
      await duePage.locator("#knowledge-topic").selectOption(topic.id);
      await duePage.locator("label.concept-choice").filter({ hasText: concept.name }).locator("input").check();
      await duePage.locator("label.mode-choice").filter({ hasText: "Quick knowledge check" }).locator("input").check();
      await duePage.getByRole("button", { name: /Start knowledge check/ }).click();
      await duePage.waitForURL(/\/assessments\/[0-9a-f-]+\?/i, { timeout: 10_000 });
      const assessmentId = new URL(duePage.url()).pathname.split("/").pop();
      await duePage.getByRole("button", { name: /Start Rapid Fire/ }).click();
      let assessment = await authenticatedApi(token, `${apiUrl}/api/assessments/${assessmentId}`);
      const setupAttempt = assessment.questions[0];
      await duePage.waitForFunction((prompt) => document.querySelector(".question-prompt")?.textContent?.trim() === prompt.trim(), setupAttempt.questionData?.prompt ?? setupAttempt.question, { timeout: 10_000 });
      if (setupAttempt.questionType === "mcq") {
        const key = (await pool.query("SELECT correct_option_id FROM canonical_question_revisions WHERE id=$1", [setupAttempt.canonicalQuestionRevisionId])).rows[0].correct_option_id;
        const answerOption = setupAttempt.questionData.options.find((option) => option.id === key);
        await duePage.locator("label.option").filter({ hasText: answerOption.text }).locator("input").check();
      } else {
        const expected = (await pool.query("SELECT expected_answer FROM canonical_question_revisions WHERE id=$1", [setupAttempt.canonicalQuestionRevisionId])).rows[0].expected_answer;
        await duePage.locator("#assessment-answer").fill(expected);
      }
      await duePage.getByRole("button", { name: /Submit answer/ }).click();
      assessment = await waitForAssessment(token, apiUrl, assessmentId, (value) => value.questions.find((item) => item.id === setupAttempt.id)?.submittedAt);
      const pendingFreeRecall = assessment.questions.find((item) => item.questionType !== "mcq" && !item.submittedAt);
      assert(pendingFreeRecall, "The supported blueprint must supply a pending free-response due-review task");
      const historicalSnapshot = (await pool.query("SELECT answer,submitted_at,canonical_question_revision_id FROM recall_attempts WHERE id=$1 AND user_id=$2", [setupAttempt.id,owner.id])).rows[0];
      const previousState = (await pool.query("SELECT concept_id,due_at,interval_days FROM review_states WHERE user_id=$1 AND concept_id=(SELECT concept_id FROM recall_attempts WHERE id=$2)", [owner.id,setupAttempt.id])).rows[0];
      assert(previousState, "The submitted setup answer must establish the learner's scheduler state");
      const dueAt = (await pool.query("UPDATE review_states SET due_at=now()-interval '1 minute',updated_at=now() WHERE user_id=$1 AND concept_id=$2 RETURNING due_at,interval_days", [owner.id,previousState.concept_id])).rows[0];
      assert(dueAt, "Only the isolated learner's review should be moved into the due window");
      await duePage.goto(`${clientUrl}/dashboard`, { waitUntil: "domcontentloaded" });
      await duePage.getByRole("link", { name: "Choose what to strengthen" }).click();
      await duePage.waitForURL("**/review", { timeout: 10_000 });
      const dueLink = duePage.locator(`a[href^="/recall/${pendingFreeRecall.id}"]`);
      await dueLink.click();
      await duePage.waitForURL(new RegExp(`/recall/${pendingFreeRecall.id}(?:\\?|$)`), { timeout: 10_000 });
      const beforeSubmission = (await authenticatedApi(token, `${apiUrl}/api/recalls/${pendingFreeRecall.id}`)).recall;
      assert.equal(beforeSubmission.submittedAt,null,"Due review must remain pending until the real form is submitted");
      const answerPoint = expectedOutcome === "partial" ? (await pool.query(`SELECT kp.statement FROM canonical_question_revision_points rp JOIN knowledge_points kp ON kp.id=rp.canonical_knowledge_point_id WHERE rp.question_revision_id=$1 ORDER BY kp.id LIMIT 1`,[beforeSubmission.canonicalQuestionRevisionId])).rows[0]?.statement : null;
      assert(expectedOutcome !== "partial" || answerPoint, "A partial due-review response needs an exact mapped point fixture");
      const answer = expectedOutcome === "incorrect" ? "zebra telescope orbit" : partialBaselineAnswer(answerPoint);
      await duePage.locator("#answer").fill(answer);
      await duePage.getByRole("button", { name: /Submit recall/ }).click();
      await duePage.waitForURL(new RegExp(`/recall/${pendingFreeRecall.id}/result`), { timeout: 10_000 });
      const result = (await authenticatedApi(token, `${apiUrl}/api/recalls/${pendingFreeRecall.id}`)).recall;
      assert(result.submittedAt && result.evaluation, `${expectedOutcome} due review should be evaluated and persisted`);
      const pointRows = await pool.query("SELECT status FROM recall_knowledge_point_results WHERE evaluation_id=(SELECT id FROM recall_evaluations WHERE recall_attempt_id=$1)", [pendingFreeRecall.id]);
      assert(pointRows.rows.some((row) => row.status === (expectedOutcome === "incorrect" ? "missing" : "partial")), `The actual grading should persist an ${expectedOutcome} outcome: ${JSON.stringify(pointRows.rows)}`);
      const nextState = (await pool.query("SELECT due_at,interval_days,last_outcome FROM review_states WHERE user_id=$1 AND concept_id=$2", [owner.id,previousState.concept_id])).rows[0];
      assert(nextState.last_outcome === (expectedOutcome === "incorrect" ? "again" : "hard"), `Scheduler must apply the configured ${expectedOutcome} outcome: ${JSON.stringify(nextState)}`);
      const expectedInterval = expectedOutcome === "incorrect" ? 1 : Math.max(1,Math.round(Number(previousState.interval_days)*1.5));
      assert(Number(nextState.interval_days) === expectedInterval, `Scheduler interval should follow the actual MVP policy from prior interval ${previousState.interval_days}: ${JSON.stringify(nextState)}`);
      assert(new Date(nextState.due_at).getTime() > new Date(dueAt.due_at).getTime(), "The persisted review timestamp should advance after submission");
      assert.deepEqual((await pool.query("SELECT answer,submitted_at,canonical_question_revision_id FROM recall_attempts WHERE id=$1 AND user_id=$2", [setupAttempt.id,owner.id])).rows[0],historicalSnapshot,"A due-review submission must preserve the prior attempt");
      await duePage.reload({ waitUntil: "domcontentloaded" });
      await duePage.locator(".review-next").waitFor({ timeout: 10_000 });
      const reloadedResultText = (await duePage.locator("body").innerText()).replace(/\s+/g," ");
      assert(reloadedResultText.includes(result.evaluation.feedback.replace(/\s+/g," ")), `The persisted evaluated result should render after reload: ${JSON.stringify({ feedback: result.evaluation.feedback, body: reloadedResultText.slice(-1200) })}`);
      await duePage.goto(`${clientUrl}/review`,{waitUntil:"domcontentloaded"});
      await duePage.reload({waitUntil:"domcontentloaded"});
      assert.equal(await duePage.locator(`a[href^="/recall/${pendingFreeRecall.id}"]`).count(),0,"A submitted incorrect or partial review must no longer be listed as due");
    } finally { await context.close(); }
  }
  await runNonCorrectDueReview("incorrect");
  await runNonCorrectDueReview("partial");

  // Full source-linked learning uses a separate account and starts from the
  // real Resources action. The PDF contains the exact canonical concept and
  // one mapped point so banked verification is eligible without copying text.
  const sourceEmail = `e2e-core-source-${Date.now()}-${Math.random().toString(16).slice(2)}@test.local`;
  const sourcePassword = `Pilot-${Math.random().toString(36).slice(2)}-${Date.now()}`;
  ownedEmails.push(sourceEmail);
  const sourceContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const sourcePage = await sourceContext.newPage();
  sourcePage.on("pageerror", (error) => browserJavaScriptErrors.push(error.message));
  sourcePage.on("requestfailed", (request) => {
    const failureText = request.failure()?.errorText ?? "request failed";
    if (studyResponseDropArmed && isExpectedInjectedStudyResponseDrop(request.method(), request.url(), failureText, new URL(clientUrl).origin)) { expectedLostStudyResponses.push(`${request.method()} ${request.url()}: ${failureText}`); return; }
    if (isExpectedCanceledRequest(request.method(), request.url(), failureText, new URL(clientUrl).origin)) expectedCanceledRequests.push(`${request.method()} ${request.url()}: ${failureText}`);
    else unexpectedFailedRequests.push(`${request.method()} ${request.url()}: ${failureText}`);
  });
  await sourcePage.route("https://fonts.googleapis.com/**", (route) => route.fulfill({ status: 200, contentType: "text/css", body: "" }));
  await sourcePage.route("https://fonts.gstatic.com/**", (route) => route.fulfill({ status: 204, body: "" }));
  await sourcePage.goto(`${clientUrl}/register`, { waitUntil: "domcontentloaded" });
  await sourcePage.locator("#name").fill("RecallLoop Source Learning Pilot");
  await sourcePage.locator("#email").fill(sourceEmail);
  await sourcePage.locator("#password").fill(sourcePassword);
  await sourcePage.getByRole("button", { name: "Create account" }).click();
  await sourcePage.waitForURL("**/onboarding", { timeout: 10_000 });
  await sourcePage.locator("#start-topic").selectOption({ label: "Databases" });
  await sourcePage.getByRole("button", { name: "Start studying" }).click();
  await sourcePage.waitForURL(/\/study\/new\?topic=/, { timeout: 10_000 });
  const sourceGoalId = new URL(sourcePage.url()).searchParams.get("goalId");
  const sourceToken = await sourcePage.evaluate(() => localStorage.getItem("recallloop_token"));
  assert(sourceGoalId && sourceToken, "Source learner must have an authenticated goal context");
  const canonicalIndex = (await pool.query("SELECT cc.id, kp.statement FROM knowledge_points kp JOIN canonical_concepts cc ON cc.id=kp.concept_id WHERE cc.name='Index selection' ORDER BY kp.importance DESC,kp.id LIMIT 1")).rows[0];
  const canonicalPoint = canonicalIndex?.statement;
  assert(canonicalIndex && canonicalPoint, "The PDF fixture must use an existing canonical assessment point");
  await sourcePage.goto(`${clientUrl}/resources`, { waitUntil: "domcontentloaded" });
  await sourcePage.getByText("Have material to study from?", { exact: true }).click();
  await sourcePage.locator("#material-type").selectOption("pdf");
  await sourcePage.locator("#material-file").setInputFiles({ name: "index-selection-learning.pdf", mimeType: "application/pdf", buffer: pdfFixture([`Index selection\n\n${canonicalPoint}\n\nA composite B-tree index supports predicates on leading columns, while index maintenance adds write cost.`]) });
  await sourcePage.getByRole("button", { name: "Upload PDF" }).click();
  await sourcePage.locator(".notice").filter({ hasText: "Extracted text from" }).waitFor({ timeout: 10_000 });
  await sourcePage.getByRole("link", { name: "Start learning session" }).click();
  await sourcePage.waitForURL(/\/study\/new\?sourceId=[0-9a-f-]+/i, { timeout: 10_000 });
  await sourcePage.locator("#study-topic").fill("Index selection");
  await sourcePage.locator("#topic-suggestions button").first().waitFor({ timeout: 15_000 });
  await sourcePage.locator("#topic-suggestions button").filter({ hasText: "Index selection" }).click();
  let committedStudyResponse;
  let droppedStudyKey;
  await sourcePage.route(`${clientUrl}/api/study-sessions`, async (route) => {
    const response = await route.fetch();
    assert.equal(response.status(), 201, "Fault injection must first allow the real server request to finish successfully");
    committedStudyResponse = await response.json();
    droppedStudyKey = route.request().postDataJSON().idempotencyKey;
    await route.abort("failed");
  });
  studyResponseDropArmed = true;
  await sourcePage.getByRole("button", { name: "Start learning session" }).click();
  await sourcePage.getByRole("alert").filter({ hasText: "retrying will reopen it" }).waitFor({ timeout: 10_000 });
  await sourcePage.unroute(`${clientUrl}/api/study-sessions`);
  studyResponseDropArmed = false;
  assert.equal(expectedLostStudyResponses.length,1,"The intended committed POST response must be the only specifically classified injected network loss");
  assert(committedStudyResponse?.session?.id && droppedStudyKey, "The fault injection must capture the committed session and request key");
  const committedSessionCount = await pool.query("SELECT count(*)::int count FROM study_sessions WHERE user_id=(SELECT id FROM app_users WHERE email=$1) AND idempotency_key=$2", [sourceEmail,droppedStudyKey]);
  assert.equal(committedSessionCount.rows[0].count, 1, "The response is dropped only after PostgreSQL committed exactly one session");
  await sourcePage.getByRole("button", { name: "Retry safely" }).click();
  await sourcePage.waitForURL(/\/study\/[0-9a-f-]+\?/i, { timeout: 20_000 });
  const linkedSourceSessionId = new URL(sourcePage.url()).pathname.split("/").pop();
  assert.equal(linkedSourceSessionId, committedStudyResponse.session.id, "Recovery must open the original committed session");
  assert.equal((await pool.query("SELECT count(*)::int count FROM study_sessions WHERE user_id=(SELECT id FROM app_users WHERE email=$1) AND idempotency_key=$2", [sourceEmail,droppedStudyKey])).rows[0].count, 1, "Retrying the same request must not duplicate the session");
  const linkedSession = await authenticatedApi(sourceToken, `${apiUrl}/api/study-sessions/${linkedSourceSessionId}`);
  const linkedConcept = linkedSession.concepts.find((concept) => concept.name === "Index selection");
  assert(linkedConcept && linkedSession.session.status === "in_progress", `Imported content should create an inspectable linked study session; observed ${JSON.stringify({ status: linkedSession.session.status, concepts: linkedSession.concepts.map((concept) => ({ name: concept.name, canonicalConceptId: concept.canonicalConceptId, points: concept.requiredKnowledgePoints })) })}`);
  assert.equal(linkedSession.session.canonicalConceptId, canonicalIndex.id, "The study session should retain the selected canonical learning objective");
  assert.equal(linkedConcept.canonicalConceptId, canonicalIndex.id, "The PDF-extracted concept should map to the selected canonical learning objective");
  const sourceRow = await pool.query("SELECT grounding_source_id FROM study_sessions WHERE id=$1 AND user_id=(SELECT id FROM app_users WHERE email=$2)", [linkedSourceSessionId, sourceEmail]);
  assert.equal(sourceRow.rows[0]?.grounding_source_id, linkedSession.session.groundingSourceId, "The study session must persist the owned source identity");
  assert.equal(linkedSession.session.rawMaterial, (await authenticatedApi(sourceToken, `${apiUrl}/api/grounding/sources/${linkedSession.session.groundingSourceId}`)).source.content, "The source session must use server-extracted document text");
  const sourcePreviewText = await sourcePage.locator(".source-study-preview").innerText();
  assert(sourcePreviewText.includes("Extracted pages: 1"), `Learner study view should retain PDF page provenance; observed ${sourcePreviewText}`);
  await sourcePage.getByRole("button", { name: "Finish review and start recall" }).click();
  await sourcePage.waitForURL(/\/recall\/[0-9a-f-]+$/i, { timeout: 10_000 });
  const sourceRecallId = new URL(sourcePage.url()).pathname.split("/").pop();
  const sourceRecall = (await authenticatedApi(sourceToken, `${apiUrl}/api/recalls/${sourceRecallId}`)).recall;
  assert.equal(sourceRecall.studySessionId, linkedSourceSessionId, "Immediate recall must remain linked to the source study session");
  if (sourceRecall.questionType === "mcq") {
    const key = (await pool.query("SELECT correct_option_id FROM canonical_question_revisions WHERE id=$1", [sourceRecall.canonicalQuestionRevisionId])).rows[0]?.correct_option_id;
    const wrong = sourceRecall.questionData.options.find((option) => option.id !== key);
    await sourcePage.locator("label.option").filter({ hasText: wrong.text }).locator("input").check();
  } else {
    await sourcePage.locator("#answer").fill("I cannot explain this concept yet.");
  }
  await sourcePage.getByRole("button", { name: /Submit recall/ }).click();
  await sourcePage.waitForURL(new RegExp(`/recall/${sourceRecallId}/result`), { timeout: 10_000 });
  const firstSourceResult = (await authenticatedApi(sourceToken, `${apiUrl}/api/recalls/${sourceRecallId}`)).recall;
  assert(firstSourceResult.submittedAt && firstSourceResult.evaluation, "Source recall should be graded and persisted");
  assert.equal(firstSourceResult.recommendation?.actionType, "recall", "A weak first recall should recommend another assessment attempt before remediation eligibility");
  await sourcePage.getByRole("button", { name: "Start a recall round" }).click();
  await sourcePage.waitForURL(/\/assessments\/[0-9a-f-]+/i, { timeout: 10_000 });
  const sourceAssessmentId = new URL(sourcePage.url()).pathname.split("/").pop();
  await sourcePage.getByRole("button", { name: /Start Rapid Fire/ }).click();
  let sourceAssessment = await authenticatedApi(sourceToken, `${apiUrl}/api/assessments/${sourceAssessmentId}`);
  const sourceAssessmentAttemptIds = [];
  while (sourceAssessment.questions.some((question) => !question.submittedAt)) {
    const current = sourceAssessment.questions.find((question) => !question.submittedAt);
    sourceAssessmentAttemptIds.push(current.id);
    await sourcePage.waitForFunction((prompt) => document.querySelector(".question-prompt")?.textContent?.trim() === prompt.trim(), current.questionData?.prompt ?? current.question, { timeout: 10_000 });
    if (current.questionType === "mcq") {
      const key = (await pool.query("SELECT correct_option_id FROM canonical_question_revisions WHERE id=$1", [current.canonicalQuestionRevisionId])).rows[0]?.correct_option_id;
      const wrong = current.questionData.options.find((option) => option.id !== key);
      await sourcePage.locator("label.option").filter({ hasText: wrong.text }).locator("input").check();
    } else if (current.questionData?.parts?.length) {
      for (const part of current.questionData.parts) await sourcePage.locator(`#assessment-answer-${part.id}`).fill("I cannot explain this yet.");
    } else {
      await sourcePage.locator("#assessment-answer").fill("I cannot explain this yet.");
    }
    await sourcePage.getByRole("button", { name: /Submit answer/ }).click();
    sourceAssessment = await waitForAssessment(sourceToken, apiUrl, sourceAssessmentId, (value) => value.questions.find((question) => question.id === current.id)?.submittedAt);
  }
  await sourcePage.locator(".report-hero").waitFor({ timeout: 10_000 });
  assert(sourceAssessment.questions.every((question) => question.submittedAt && question.evaluation), "Source-linked assessment answers must all be evaluated and persisted");
  const sourceAssessmentLinkage = await pool.query("SELECT count(*)::int AS count FROM recall_attempts WHERE assessment_session_id=$1 AND user_id=(SELECT id FROM app_users WHERE email=$2) AND study_session_id=$3", [sourceAssessmentId, sourceEmail, linkedSourceSessionId]);
  assert.equal(sourceAssessmentLinkage.rows[0].count, sourceAssessment.questions.length, "Every source assessment attempt must inherit the source session relationship");
  assert.equal(sourceAssessment.result?.recommendation?.actionType, "remediation", "Repeated weak source-linked evidence should unlock focused remediation");
  await sourcePage.getByRole("button", { name: "Open focused review" }).click();
  await sourcePage.waitForURL(/\/remediations\/[0-9a-f-]+$/i, { timeout: 10_000 });
  const sourceRemediationId = new URL(sourcePage.url()).pathname.split("/").pop();
  const sourceRemediation = (await authenticatedApi(sourceToken, `${apiUrl}/api/remediations/${sourceRemediationId}`)).remediation;
  assert(sourceRemediation.status === "ready" && sourceRemediation.sources.some((item) => item.sourceType === "pdf" && Number(item.pageNumber) === 1), "Focused remediation should retrieve the linked PDF content with page citation");
  await sourcePage.getByRole("button", { name: /Check what you remember/ }).click();
  await sourcePage.waitForURL(/\/recall\/[0-9a-f-]+$/i, { timeout: 10_000 });
  const sourceVerificationId = new URL(sourcePage.url()).pathname.split("/").pop();
  const sourceVerification = (await authenticatedApi(sourceToken, `${apiUrl}/api/recalls/${sourceVerificationId}`)).recall;
  assert(sourceVerification.canonicalQuestionRevisionId && !sourceAssessment.questions.some((question) => question.canonicalQuestionRevisionId === sourceVerification.canonicalQuestionRevisionId), "Source verification must use an unseen immutable question revision");
  if (sourceVerification.questionType === "mcq") {
    const key = (await pool.query("SELECT correct_option_id FROM canonical_question_revisions WHERE id=$1", [sourceVerification.canonicalQuestionRevisionId])).rows[0]?.correct_option_id;
    await sourcePage.locator("label.option").filter({ hasText: sourceVerification.questionData.options.find((option) => option.id === key).text }).locator("input").check();
  } else {
    const expected = (await pool.query("SELECT expected_answer FROM canonical_question_revisions WHERE id=$1", [sourceVerification.canonicalQuestionRevisionId])).rows[0]?.expected_answer;
    await sourcePage.locator("#answer").fill([expected, sourceRemediation.knowledgePoint].filter(Boolean).join("\n"));
  }
  await sourcePage.getByRole("button", { name: /Submit recall/ }).click();
  await sourcePage.waitForURL(new RegExp(`/recall/${sourceVerificationId}/result`), { timeout: 10_000 });
  const verifiedSourceRemediation = (await authenticatedApi(sourceToken, `${apiUrl}/api/remediations/${sourceRemediationId}`)).remediation;
  assert.equal(verifiedSourceRemediation.status, "verified");
  assert.equal(verifiedSourceRemediation.improved, true, "Only the persisted distinct source-linked answer can verify improvement");
  const verifiedCanonicalPoint = (await pool.query(`SELECT kp.id FROM canonical_question_revision_points rp JOIN knowledge_points kp ON kp.id=rp.canonical_knowledge_point_id WHERE rp.question_revision_id=$1 AND kp.statement=$2`, [sourceVerification.canonicalQuestionRevisionId, verifiedSourceRemediation.knowledgePoint])).rows[0];
  assert(verifiedCanonicalPoint, "The later verification revision must retain the exact canonical point mapping");
  const verifiedPointHistory = await pool.query(`SELECT a.id,a.canonical_question_revision_id,r.status,a.answer,a.selected_option_id FROM recall_attempts a JOIN recall_evaluations e ON e.recall_attempt_id=a.id JOIN recall_knowledge_point_results r ON r.evaluation_id=e.id WHERE a.user_id=(SELECT id FROM app_users WHERE email=$1) AND r.canonical_knowledge_point_id=$2 ORDER BY a.submitted_at DESC,a.created_at DESC,a.id DESC,r.id DESC`, [sourceEmail, verifiedCanonicalPoint.id]);
  assert(verifiedPointHistory.rows.some((row) => row.status === "missing" && (row.selected_option_id || row.answer?.trim())), "The same point should retain its earlier wrong nonblank evidence in history");
  assert.equal(verifiedPointHistory.rows[0]?.id, sourceVerificationId, "The later successful verification must be the authoritative latest point evidence");
  assert.equal(verifiedPointHistory.rows[0]?.status, "correct");
  assert(!verifiedPointHistory.rows.slice(1).some((row) => row.canonical_question_revision_id === sourceVerification.canonicalQuestionRevisionId), "The successful verification must use a revision not already attempted for that point");
  const sourceReadiness = await authenticatedApi(sourceToken, `${apiUrl}/api/goals/${sourceGoalId}/readiness`);
  assert(sourceReadiness.skills.some((skill) => skill.name === "Databases" && skill.assessedPoints > 0), "Source-linked recall and verification should update goal readiness evidence");
  await sourcePage.goto(`${clientUrl}/readiness?goalId=${sourceGoalId}`, { waitUntil: "domcontentloaded" });
  await sourcePage.getByRole("heading", { name: "My Readiness" }).waitFor();
  await sourcePage.reload({ waitUntil: "domcontentloaded" });
  assert((await authenticatedApi(sourceToken, `${apiUrl}/api/goals/${sourceGoalId}/readiness`)).skills.some((skill) => skill.assessedPoints > 0), "Source-linked readiness should survive page reload");

  // Delete a second test-owned source while it remains visible in Resources,
  // then use its real study action and verify no partial session is written.
  await sourcePage.goto(`${clientUrl}/resources`, { waitUntil: "domcontentloaded" });
  await sourcePage.getByText("Have material to study from?", { exact: true }).click();
  const deletedSourceTitle = `Deleted before study ${Date.now()}`;
  await sourcePage.locator("#material-title").fill(deletedSourceTitle);
  await sourcePage.locator("#material-text").fill("A resource deleted before study must not create a session.");
  await sourcePage.getByRole("button", { name: "Save learning material" }).click();
  const deletedSourceRow = sourcePage.locator(".source-row").filter({ hasText: deletedSourceTitle });
  const deletedSourceLink = deletedSourceRow.getByRole("link", { name: "Start learning session" });
  await deletedSourceLink.waitFor({ timeout: 10_000 });
  const deletedSourceHref = await deletedSourceLink.getAttribute("href");
  const deletedSourceId = new URL(deletedSourceHref, clientUrl).searchParams.get("sourceId");
  assert(deletedSourceId, "The imported source row should link to its source study setup");
  const studyCountBeforeDeletion = (await pool.query("SELECT count(*)::int count FROM study_sessions WHERE user_id=(SELECT id FROM app_users WHERE email=$1)", [sourceEmail])).rows[0].count;
  const deletedRows = await pool.query("DELETE FROM grounding_sources WHERE id=$1 AND user_id=(SELECT id FROM app_users WHERE email=$2) RETURNING id", [deletedSourceId,sourceEmail]);
  assert.equal(deletedRows.rowCount, 1, "Lifecycle setup must remove only the isolated learner's source");
  await deletedSourceLink.click();
  await sourcePage.waitForURL(`**/study/new?sourceId=${deletedSourceId}`, { timeout: 10_000 });
  await sourcePage.getByRole("alert").filter({ hasText: "unavailable" }).waitFor({ timeout: 10_000 });
  const missingSourceResponse = await fetch(`${apiUrl}/api/grounding/sources/${deletedSourceId}`, { headers: { Authorization: `Bearer ${sourceToken}` } });
  assert.equal(missingSourceResponse.status, 404, "A deleted source must remain unavailable through the owner-scoped API");
  assert.equal((await pool.query("SELECT count(*)::int count FROM study_sessions WHERE user_id=(SELECT id FROM app_users WHERE email=$1)", [sourceEmail])).rows[0].count, studyCountBeforeDeletion, "Starting from a deleted source must not create a study session");
  await sourcePage.goto(`${clientUrl}/resources`, { waitUntil: "domcontentloaded" });
  await sourcePage.reload({ waitUntil: "domcontentloaded" });
  await sourcePage.locator("details.source-contribution summary").click();
  await sourcePage.locator(".source-row").filter({ hasText: "index-selection-learning.pdf" }).waitFor({ timeout: 10_000 });

  async function createReadinessAssessment(conceptName, domainName = "Database Management Systems") {
    const coverage = await authenticatedApi(sourceToken, `${apiUrl}/api/assessments/coverage`);
    const subject = coverage.subjects.find((item) => item.domainName === domainName);
    const topic = subject?.topics.find((item) => item.concepts.some((concept) => concept.name === conceptName));
    const concept = topic?.concepts.find((item) => item.name === conceptName && item.supportedModes.includes("rapid_fire"));
    assert(subject && topic && concept, `${conceptName} in ${domainName} needs an eligible supported blueprint`);
    await sourcePage.goto(`${clientUrl}/knowledge-check`, { waitUntil: "domcontentloaded" });
    await sourcePage.locator("#knowledge-subject").selectOption(subject.id);
    await sourcePage.locator("#knowledge-topic").selectOption(topic.id);
    await sourcePage.locator("label.concept-choice").filter({ hasText: conceptName }).locator("input").check();
    await sourcePage.locator("label.mode-choice").filter({ hasText: "Quick knowledge check" }).locator("input").check();
    await sourcePage.getByRole("button", { name: /Start knowledge check/ }).click();
    await sourcePage.waitForURL(/\/assessments\/[0-9a-f-]+\?/, { timeout: 10_000 });
    const assessmentId = new URL(sourcePage.url()).pathname.split("/").pop();
    await sourcePage.getByRole("button", { name: /Start Rapid Fire/ }).click();
    const assessment = await authenticatedApi(sourceToken, `${apiUrl}/api/assessments/${assessmentId}`);
    const mappings = await pool.query(`SELECT a.id attempt_id, a.question_type, kp.id point_id, kp.statement FROM recall_attempts a JOIN canonical_question_revision_points rp ON rp.question_revision_id=a.canonical_question_revision_id JOIN knowledge_points kp ON kp.id=rp.canonical_knowledge_point_id WHERE a.id=ANY($1::uuid[])`, [assessment.questions.map((question) => question.id)]);
    assert.equal(mappings.rowCount, 5, "Every selected immutable revision must map to one canonical point");
    return { assessmentId, assessment, mappings: new Map(mappings.rows.map((row) => [row.attempt_id, row])) };
  }
  const readinessRuns = [await createReadinessAssessment("Read replication"), await createReadinessAssessment("Isolation and atomicity")];
  const lastByPoint = new Map();
  for (const run of readinessRuns) for (const question of run.assessment.questions) lastByPoint.set(run.mappings.get(question.id).point_id, { question, mapping: run.mappings.get(question.id) });
  const outcomesByPoint = new Map();
  const availablePoints = [...lastByPoint.entries()];
  function planOutcome(outcome, canApply = () => true) {
    const found = availablePoints.find(([, value]) => canApply(value.question));
    assert(found, `The real assessment blueprint needs an independent point whose final question supports ${outcome}`);
    outcomesByPoint.set(found[0], outcome);
    availablePoints.splice(availablePoints.indexOf(found), 1);
  }
  planOutcome("partial", (question) => question.questionType !== "mcq");
  planOutcome("unanswered");
  planOutcome("incorrect");
  planOutcome("correct");
  for (const run of readinessRuns) {
    await sourcePage.goto(`${clientUrl}/assessments/${run.assessmentId}`, { waitUntil: "domcontentloaded" });
    await sourcePage.getByRole("button", { name: /Start Rapid Fire/ }).waitFor({ state: "visible", timeout: 10_000 });
    await sourcePage.getByRole("button", { name: /Start Rapid Fire/ }).click();
    let assessment = await authenticatedApi(sourceToken, `${apiUrl}/api/assessments/${run.assessmentId}`);
    while (assessment.questions.some((question) => !question.submittedAt)) {
      const question = assessment.questions.find((item) => !item.submittedAt);
      const mapping = run.mappings.get(question.id);
      const isLast = lastByPoint.get(mapping.point_id).question.id === question.id;
      const outcome = isLast ? outcomesByPoint.get(mapping.point_id) : "correct";
      try {
        await sourcePage.waitForFunction((prompt) => document.querySelector(".question-prompt")?.textContent?.trim() === prompt.trim(), question.questionData?.prompt ?? question.question, { timeout: 10_000 });
      } catch {
        throw new Error(`Readiness assessment question did not render (assessment=${run.assessmentId}, attempt=${question.id}, expected=${JSON.stringify(question.questionData?.prompt ?? question.question)}, url=${sourcePage.url()}, body=${JSON.stringify((await sourcePage.locator("body").innerText()).slice(-1200))})`);
      }
      if (outcome === "unanswered") await sourcePage.getByRole("button", { name: /Skip \/ I/ }).click();
      else if (question.questionType === "mcq") {
        const key = (await pool.query("SELECT correct_option_id FROM canonical_question_revisions WHERE id=$1", [question.canonicalQuestionRevisionId])).rows[0]?.correct_option_id;
        const answer = question.questionData.options.find((option) => outcome === "incorrect" ? option.id !== key : option.id === key);
        await sourcePage.locator("label.option").filter({ hasText: answer.text }).locator("input").check();
        await sourcePage.getByRole("button", { name: /Submit answer/ }).click();
      } else {
        const response = outcome === "partial" ? partialBaselineAnswer(mapping.statement) : outcome === "incorrect" ? "zebra telescope orbit" : mapping.statement;
        await sourcePage.locator("#assessment-answer").fill(response);
        await sourcePage.getByRole("button", { name: /Submit answer/ }).click();
      }
      assessment = await waitForAssessment(sourceToken, apiUrl, run.assessmentId, (data) => data.questions.find((item) => item.id === question.id)?.submittedAt);
    }
    assert(assessment.result, "Real submitted answers should produce an assessment report");
  }
  const readinessMatrix = await authenticatedApi(sourceToken, `${apiUrl}/api/goals/${sourceGoalId}/readiness`);
  const matrixSkill = readinessMatrix.skills.find((skill) => skill.name === "Databases");
  assert(matrixSkill.strengths > 0 && matrixSkill.partial > 0 && matrixSkill.incorrect > 0 && matrixSkill.unanswered > 0 && matrixSkill.unassessedPoints > 0, `The canonical readiness projection must retain five states; got ${JSON.stringify(matrixSkill)}`);
  const plannedPointOutcomes = await pool.query(`WITH latest AS (SELECT DISTINCT ON (r.canonical_knowledge_point_id) r.canonical_knowledge_point_id,r.status,a.answer,a.selected_option_id FROM recall_attempts a JOIN recall_evaluations e ON e.recall_attempt_id=a.id JOIN recall_knowledge_point_results r ON r.evaluation_id=e.id WHERE a.user_id=(SELECT id FROM app_users WHERE email=$1) AND r.canonical_knowledge_point_id=ANY($2::uuid[]) AND a.submitted_at IS NOT NULL ORDER BY r.canonical_knowledge_point_id,a.submitted_at DESC,a.created_at DESC,a.id DESC,r.id DESC) SELECT canonical_knowledge_point_id,CASE WHEN status='correct' THEN 'correct' WHEN status='partial' THEN 'partial' WHEN status='missing' AND (selected_option_id IS NOT NULL OR NULLIF(trim(answer),'') IS NOT NULL) THEN 'incorrect' WHEN status='missing' THEN 'unanswered' END outcome FROM latest`, [sourceEmail, [...outcomesByPoint.keys()]]);
  const persistedOutcomes = new Map(plannedPointOutcomes.rows.map((row) => [row.canonical_knowledge_point_id, row.outcome]));
  for (const [pointId, expected] of outcomesByPoint) assert.equal(persistedOutcomes.get(pointId), expected, `Point ${pointId} should persist its evaluated ${expected} outcome`);
  assert.equal(matrixSkill.assessedPoints, matrixSkill.strengths + matrixSkill.partial + matrixSkill.incorrect + matrixSkill.unanswered, "Assessed counts must equal the mutually exclusive submitted outcomes");
  await sourcePage.goto(`${clientUrl}/readiness?goalId=${sourceGoalId}`, { waitUntil: "domcontentloaded" });
  await sourcePage.getByRole("heading", { name: "My Readiness" }).waitFor();
  const readinessSkillCard = sourcePage.locator(".readiness-skill").filter({ hasText: "Databases" });
  const matrixText = await readinessSkillCard.innerText();
  for (const [label, count] of [["Demonstrated", matrixSkill.strengths], ["Partial", matrixSkill.partial], ["Incorrect", matrixSkill.incorrect], ["Unanswered", matrixSkill.unanswered], ["No submitted evidence", matrixSkill.unassessedPoints]]) assert(matrixText.includes(`${label}\n${count}`), `The page must display ${label}=${count}; got ${matrixText}`);
  await sourcePage.reload({ waitUntil: "domcontentloaded" });
  const reloadedMatrixText = await sourcePage.locator(".readiness-skill").filter({ hasText: "Databases" }).innerText();
  for (const [label, count] of [["Demonstrated", matrixSkill.strengths], ["Partial", matrixSkill.partial], ["Incorrect", matrixSkill.incorrect], ["Unanswered", matrixSkill.unanswered], ["No submitted evidence", matrixSkill.unassessedPoints]]) assert(reloadedMatrixText.includes(`${label}\n${count}`), `Reload must preserve ${label}=${count}`);

  const coverageForOtherDomains = await authenticatedApi(sourceToken, `${apiUrl}/api/assessments/coverage`);
  const additionalDomains = ["Operating Systems", "Computer Networks", "Data Structures and Algorithms", "System Design"];
  for (const domainName of additionalDomains) {
    const domainSubject = coverageForOtherDomains.subjects.find((item) => item.domainName === domainName && item.topics.some((topic) => topic.concepts.some((concept) => concept.supportedModes.includes("rapid_fire"))));
    assert(domainSubject, `${domainName} needs at least one currently eligible Rapid Fire concept for cross-domain readiness verification`);
    await sourcePage.goto(`${clientUrl}/goals/${sourceGoalId}`, { waitUntil: "domcontentloaded" });
    const skillCard = sourcePage.locator(".goal-skill-evidence").filter({ has: sourcePage.getByRole("heading", { name: domainSubject.name, exact: true }) });
    if (!(await skillCard.count())) {
      await sourcePage.locator("#skill-name").fill(domainSubject.name);
      await sourcePage.locator("#skill-description").fill(`E2E mapped readiness focus for ${domainName}`);
      await sourcePage.getByRole("button", { name: "Add skill" }).click();
      await sourcePage.locator(".goal-skill-evidence").filter({ has: sourcePage.getByRole("heading", { name: domainSubject.name, exact: true }) }).waitFor({ timeout: 10_000 });
    }
    const domainConcept = domainSubject.topics.flatMap((topic) => topic.concepts).find((concept) => concept.supportedModes.includes("rapid_fire"));
    const run = await createReadinessAssessment(domainConcept.name, domainName);
    await sourcePage.goto(`${clientUrl}/assessments/${run.assessmentId}`, { waitUntil: "domcontentloaded" });
    await sourcePage.getByRole("button", { name: /Start Rapid Fire/ }).click();
    let domainAssessment = await authenticatedApi(sourceToken, `${apiUrl}/api/assessments/${run.assessmentId}`);
    while (domainAssessment.questions.some((question) => !question.submittedAt)) {
      const question = domainAssessment.questions.find((item) => !item.submittedAt);
      await sourcePage.waitForFunction((prompt) => document.querySelector(".question-prompt")?.textContent?.trim() === prompt.trim(), question.questionData?.prompt ?? question.question, { timeout: 10_000 });
      if (question.questionType === "mcq") {
        const key = (await pool.query("SELECT correct_option_id FROM canonical_question_revisions WHERE id=$1", [question.canonicalQuestionRevisionId])).rows[0]?.correct_option_id;
        const answer = question.questionData.options.find((option) => option.id === key);
        assert(answer, `A valid answer key must exist for ${domainName} question ${question.id}`);
        await sourcePage.locator("label.option").filter({ hasText: answer.text }).locator("input").check();
      } else {
        const key = (await pool.query("SELECT expected_answer FROM canonical_question_revisions WHERE id=$1", [question.canonicalQuestionRevisionId])).rows[0]?.expected_answer;
        assert(key?.trim(), `A supported answer contract must exist for ${domainName} question ${question.id}`);
        await sourcePage.locator("#assessment-answer").fill(key);
      }
      await sourcePage.getByRole("button", { name: /Submit answer/ }).click();
      domainAssessment = await waitForAssessment(sourceToken, apiUrl, run.assessmentId, (value) => value.questions.find((item) => item.id === question.id)?.submittedAt);
    }
    assert(domainAssessment.questions.every((question) => question.evaluation), `${domainName} assessment evidence must persist for every submitted question`);
    const domainReadiness = await authenticatedApi(sourceToken, `${apiUrl}/api/goals/${sourceGoalId}/readiness`);
    const mapped = domainReadiness.skills.find((skill) => skill.name === domainSubject.name);
    assert(mapped?.canonicalSkill && mapped.totalPoints > 0 && mapped.assessedPoints > 0 && mapped.assessedPoints + mapped.unassessedPoints === mapped.totalPoints, `${domainName} should partition its canonical points into submitted and unassessed evidence without inventing mastery: ${JSON.stringify(mapped)}`);
    await sourcePage.goto(`${clientUrl}/readiness?goalId=${sourceGoalId}`, { waitUntil: "domcontentloaded" });
    const readinessCard = sourcePage.locator(".readiness-skill").filter({ hasText: domainSubject.name });
    await readinessCard.getByText(new RegExp(`${mapped.assessedPoints} of ${mapped.totalPoints} knowledge points`)).waitFor({ timeout: 10_000 });
    await sourcePage.reload({ waitUntil: "domcontentloaded" });
    await sourcePage.locator(".readiness-skill").filter({ hasText: domainSubject.name }).getByText(new RegExp(`${mapped.assessedPoints} of ${mapped.totalPoints} knowledge points`)).waitFor({ timeout: 10_000 });
    await sourcePage.goto(`${clientUrl}/goals/${sourceGoalId}`, { waitUntil: "domcontentloaded" });
    const goalCard = sourcePage.locator(".goal-skill-evidence").filter({ hasText: domainSubject.name });
    await goalCard.getByText(`${mapped.assessedPoints} of ${mapped.totalPoints} canonical points have submitted evidence`).waitFor({ timeout: 10_000 });
  }

  await sourcePage.goto(`${clientUrl}/goals/new`, { waitUntil: "domcontentloaded" });
  const secondGoalTitle = `Cross-domain scope ${Date.now()}`;
  await sourcePage.locator("#goal-title").fill(secondGoalTitle);
  await sourcePage.getByRole("button", { name: "Create goal" }).click();
  await sourcePage.waitForURL(/\/goals\/[0-9a-f-]+$/i, { timeout: 10_000 });
  const secondGoalId = new URL(sourcePage.url()).pathname.split("/").pop();
  async function addGoalFocus(name) {
    await sourcePage.locator("#skill-name").fill(name);
    await sourcePage.locator("#skill-description").fill(`E2E goal-scope focus: ${name}`);
    await sourcePage.getByRole("button", { name: "Add skill" }).click();
    await sourcePage.locator(".goal-skill-evidence").filter({ has: sourcePage.getByRole("heading", { name, exact: true }) }).waitFor({ timeout: 10_000 });
  }
  const osSubject = coverageForOtherDomains.subjects.find((item) => item.domainName === "Operating Systems");
  assert(osSubject, "The shared canonical Operating Systems skill should exist");
  await addGoalFocus(osSubject.name);
  const unmappedFocus = `Personal scope ${Date.now()}`;
  await addGoalFocus(unmappedFocus);
  const secondGoalReadiness = await authenticatedApi(sourceToken, `${apiUrl}/api/goals/${secondGoalId}/readiness`);
  const sharedOsEvidence = secondGoalReadiness.skills.find((skill) => skill.name === osSubject.name);
  assert(sharedOsEvidence?.assessedPoints > 0, "A shared canonical skill should consistently reuse the learner's point evidence across goals");
  assert.equal(secondGoalReadiness.skills.find((skill) => skill.name === unmappedFocus)?.status, "unmapped", "A custom skill without an exact canonical mapping must remain unmapped");
  assert(!secondGoalReadiness.skills.some((skill) => ["Databases", "Computer Networks"].includes(skill.name)), "Canonical skills omitted from this goal must not leak into its readiness scope");
  await sourcePage.goto(`${clientUrl}/readiness?goalId=${secondGoalId}`, { waitUntil: "domcontentloaded" });
  const sharedCard = sourcePage.locator(".readiness-skill").filter({ hasText: osSubject.name });
  await sharedCard.getByText(new RegExp(`${sharedOsEvidence.assessedPoints} of ${sharedOsEvidence.totalPoints} knowledge points`)).waitFor({ timeout: 10_000 });
  await sourcePage.getByText(/No exact canonical skill mapping is available yet/).waitFor({ timeout: 10_000 });
  await sourcePage.reload({ waitUntil: "domcontentloaded" });
  await sourcePage.locator(".readiness-skill").filter({ hasText: osSubject.name }).getByText(new RegExp(`${sharedOsEvidence.assessedPoints} of ${sharedOsEvidence.totalPoints} knowledge points`)).waitFor({ timeout: 10_000 });
  await sourcePage.goto(`${clientUrl}/goals/${secondGoalId}`, { waitUntil: "domcontentloaded" });
  await sourcePage.locator(".goal-skill-evidence").filter({ hasText: osSubject.name }).getByText(`${sharedOsEvidence.assessedPoints} of ${sharedOsEvidence.totalPoints} canonical points have submitted evidence`).waitFor({ timeout: 10_000 });

  const isolationEmail = `e2e-readiness-isolation-${Date.now()}-${Math.random().toString(16).slice(2)}@test.local`;
  const isolationPassword = `Pilot-${Math.random().toString(36).slice(2)}-${Date.now()}`;
  ownedEmails.push(isolationEmail);
  const isolationContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const isolationPage = await isolationContext.newPage();
  isolationPage.on("pageerror", (error) => browserJavaScriptErrors.push(error.message));
  isolationPage.on("requestfailed", (request) => {
    const failureText = request.failure()?.errorText ?? "request failed";
    if (isExpectedCanceledRequest(request.method(), request.url(), failureText, new URL(clientUrl).origin)) expectedCanceledRequests.push(`${request.method()} ${request.url()}: ${failureText}`);
    else unexpectedFailedRequests.push(`${request.method()} ${request.url()}: ${failureText}`);
  });
  await isolationPage.route("https://fonts.googleapis.com/**", (route) => route.fulfill({ status: 200, contentType: "text/css", body: "" }));
  await isolationPage.route("https://fonts.gstatic.com/**", (route) => route.fulfill({ status: 204, body: "" }));
  await isolationPage.goto(`${clientUrl}/register`, { waitUntil: "domcontentloaded" });
  await isolationPage.locator("#name").fill("RecallLoop Readiness Isolation Pilot");
  await isolationPage.locator("#email").fill(isolationEmail);
  await isolationPage.locator("#password").fill(isolationPassword);
  await isolationPage.getByRole("button", { name: "Create account" }).click();
  await isolationPage.waitForURL("**/onboarding", { timeout: 10_000 });
  await isolationPage.locator("#start-topic").selectOption({ label: "Databases" });
  await isolationPage.getByRole("button", { name: "Start studying" }).click();
  await isolationPage.waitForURL(/\/study\/new\?topic=/, { timeout: 10_000 });
  const isolationToken = await isolationPage.evaluate(() => localStorage.getItem("recallloop_token"));
  const isolationGoalId = new URL(isolationPage.url()).searchParams.get("goalId");
  const isolationUser = (await pool.query("SELECT id FROM app_users WHERE email=$1", [isolationEmail])).rows[0];
  assert(isolationToken && isolationGoalId && isolationUser, "Learner B must register and persist an independent account and goal");
  const learnerBReadiness = await authenticatedApi(isolationToken, `${apiUrl}/api/goals/${isolationGoalId}/readiness`);
  const learnerBDatabase = learnerBReadiness.skills.find((skill) => skill.name === "Databases");
  assert(learnerBDatabase?.canonicalSkill && learnerBDatabase.totalPoints > 0);
  assert.equal(learnerBDatabase.assessedPoints, 0);
  assert.equal(learnerBDatabase.unassessedPoints, learnerBDatabase.totalPoints, "Learner A evidence must not appear in Learner B's identical canonical skill");
  await isolationPage.goto(`${clientUrl}/readiness?goalId=${isolationGoalId}`, { waitUntil: "domcontentloaded" });
  const learnerBReadinessText = await isolationPage.locator(".readiness-skill").filter({ hasText: "Databases" }).innerText();
  assert(learnerBReadinessText.includes("No submitted mapped evidence yet"));
  assert(learnerBReadinessText.includes(`No submitted evidence\n${learnerBDatabase.totalPoints}`));
  for (const [url, label] of [
    [`${apiUrl}/api/assessments/${readinessRuns[0].assessmentId}`, "Learner A assessment"],
    [`${apiUrl}/api/recalls/${readinessRuns[0].assessment.questions[0].id}`, "Learner A recall"],
    [`${apiUrl}/api/grounding/sources/${linkedSession.session.groundingSourceId}`, "Learner A resource"],
    [`${apiUrl}/api/remediations/${sourceRemediationId}`, "Learner A remediation"],
  ]) {
    const response = await fetch(url, { headers: { Authorization: `Bearer ${isolationToken}` } });
    assert.equal(response.status, 404, `${label} must remain owner-scoped`);
  }
  const learnerBDashboard = await authenticatedApi(isolationToken, `${apiUrl}/api/dashboard`);
  const learnerBWeakConcepts = await authenticatedApi(isolationToken, `${apiUrl}/api/learner/weak-concepts`);
  assert(!JSON.stringify([learnerBDashboard, learnerBWeakConcepts]).includes(sourceEmail), "Learner B dashboard and weakness projection must not contain Learner A data");
  await isolationPage.goto(`${clientUrl}/dashboard`, { waitUntil: "domcontentloaded" });
  await isolationPage.getByRole("button", { name: /Sign out/i }).click();
  await isolationPage.waitForURL("**/login", { timeout: 10_000 });
  await isolationPage.locator("#email").fill(sourceEmail);
  await isolationPage.locator("#password").fill(sourcePassword);
  await isolationPage.getByRole("button", { name: "Sign in" }).click();
  await isolationPage.waitForURL("**/dashboard", { timeout: 10_000 });
  const restoredAToken = await isolationPage.evaluate(() => localStorage.getItem("recallloop_token"));
  assert(restoredAToken && restoredAToken !== isolationToken);
  await isolationPage.goto(`${clientUrl}/readiness?goalId=${sourceGoalId}`, { waitUntil: "domcontentloaded" });
  const restoredA = await authenticatedApi(restoredAToken, `${apiUrl}/api/goals/${sourceGoalId}/readiness`);
  assert(restoredA.skills.find((skill) => skill.name === "Databases").incorrect > 0, "Signing back into Learner A must restore persisted readiness evidence");
  const restoredAText = await isolationPage.locator(".readiness-skill").filter({ hasText: "Databases" }).innerText();
  assert(restoredAText.includes(`Incorrect\n${restoredA.skills.find((skill) => skill.name === "Databases").incorrect}`));
  await isolationPage.getByRole("button", { name: /Sign out/i }).click();
  await isolationPage.waitForURL("**/login", { timeout: 10_000 });
  await isolationPage.locator("#email").fill(isolationEmail);
  await isolationPage.locator("#password").fill(isolationPassword);
  await isolationPage.getByRole("button", { name: "Sign in" }).click();
  await isolationPage.waitForURL("**/dashboard", { timeout: 10_000 });
  const restoredBToken = await isolationPage.evaluate(() => localStorage.getItem("recallloop_token"));
  assert(restoredBToken && restoredBToken !== restoredAToken, "Logging Learner B back in should establish a fresh authenticated session");
  const restoredBUser = await authenticatedApi(restoredBToken, `${apiUrl}/api/auth/me`);
  assert.equal(restoredBUser.user.email, isolationEmail, "The client should restore Learner B rather than retain Learner A's identity");
  assert.equal((await authenticatedApi(restoredBToken, `${apiUrl}/api/goals/${isolationGoalId}/readiness`)).skills.find((skill) => skill.name === "Databases").assessedPoints, 0);
  await isolationContext.close();
  await sourceContext.close();

  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await page.goto(`${clientUrl}/dashboard`, { waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { name: /What would you like to do\?|Choose your next learning step/ }).waitFor({ timeout: 10_000 });
    const layout = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth }));
    assert.equal(layout.width, viewport.width);
    assert(layout.scrollWidth <= viewport.width, `Dashboard should not overflow at ${viewport.width}px (scroll width ${layout.scrollWidth})`);
  }
  await page.goto(`${clientUrl}/resources`, { waitUntil: "domcontentloaded" });
  const disclosure = page.locator("details.source-contribution summary");
  await disclosure.focus();
  await page.keyboard.press("Enter");
  assert.equal(await page.locator("details.source-contribution").evaluate((element) => element.open), true, "The source form disclosure should open from the keyboard");

  const persistedAttemptIds = [...originalAttemptIds, ...(verificationId ? [verificationId] : [])];
  const evidence = await pool.query(`SELECT count(*)::int AS attempts, count(*) FILTER (WHERE submitted_at IS NOT NULL)::int AS submitted, count(DISTINCT canonical_question_revision_id)::int AS revisions FROM recall_attempts WHERE user_id=$1 AND id=ANY($2::uuid[])`, [userId, persistedAttemptIds]);
  assert(evidence.rows[0].attempts >= originalAttemptIds.length && evidence.rows[0].submitted >= originalAttemptIds.length, "Completed journey attempts must remain persisted for the isolated learner");
  if (verificationId) assert(evidence.rows[0].revisions >= 2, "Persisted assessment and verification evidence must reference distinct revisions");
  assert.deepEqual(browserJavaScriptErrors, [], `Uncaught browser JavaScript exceptions: ${browserJavaScriptErrors.join("; ")}`);
  assert.deepEqual(unexpectedFailedRequests, [], `Unexpected failed network requests: ${unexpectedFailedRequests.join("; ")}`);
  if (expectedCanceledRequests.length) console.log(`Expected canceled requests (${expectedCanceledRequests.length}): ${expectedCanceledRequests.join("; ")}`);
  if (traceStarted) {
    await browserContext.tracing.stop();
    traceStarted = false;
  }
  console.log(`PASS ${browserName} Playwright core loop: source-linked study/recall/remediation/distinct verification, due review/scheduler/reload, positive baseline, authentication logout/login, dashboard destinations, ingestion/provenance, canonical DBMS assessment/improvement, readiness matrix/isolation, responsive and keyboard checks (${originalAttemptIds.length} main assessment attempts, ${evidence.rows[0].revisions} revisions; learner A DBMS latest outcomes correct=${matrixSkill.strengths}, partial=${matrixSkill.partial}, incorrect=${matrixSkill.incorrect}, unanswered=${matrixSkill.unanswered}, unassessed=${matrixSkill.unassessedPoints}; learner B assessed=${learnerBDatabase.assessedPoints}, unassessed=${learnerBDatabase.unassessedPoints}; matrix point outcomes=${JSON.stringify([...outcomesByPoint.entries()])})`);
} catch (error) {
  if (page) {
    console.error(`Browser state at failure (${page.url()}):\n${(await page.locator("body").innerText().catch(() => "unavailable")).slice(-3000)}`);
    console.error(`Uncaught browser JavaScript exceptions: ${JSON.stringify(browserJavaScriptErrors)}`);
    console.error(`Unexpected failed network requests: ${JSON.stringify(unexpectedFailedRequests)}`);
    console.error(`Known canceled requests: ${JSON.stringify(expectedCanceledRequests)}`);
    console.error(`Intentionally dropped committed study responses: ${JSON.stringify(expectedLostStudyResponses)}`);
    const artifactsDirectory = process.env.E2E_ARTIFACT_DIR ?? path.join(root, "test-results");
    await mkdir(artifactsDirectory, { recursive: true }).catch(() => {});
    await page.screenshot({ path: path.join(artifactsDirectory, `${browserName}-failure.png`), fullPage: true }).catch((captureError) => console.error(`Could not capture failure screenshot: ${captureError.message}`));
    if (traceStarted) {
      await browserContext.tracing.stop({ path: path.join(artifactsDirectory, `${browserName}-trace.zip`) }).catch((traceError) => console.error(`Could not save Playwright trace: ${traceError.message}`));
      traceStarted = false;
    }
  }
  for (const entry of processes) console.error(`${entry.name} output: ${entry.output}`);
  throw error;
} finally {
  if (traceStarted) await browserContext?.tracing.stop().catch(() => {});
  await browser?.close().catch(() => {});
  for (const ownedEmail of ownedEmails) await pool.query("DELETE FROM app_users WHERE email=$1", [ownedEmail]).catch((error) => console.error(`Could not clean up isolated pilot learner ${ownedEmail}:`, error.message));
  const remainingPilotLearners = await pool.query("SELECT count(*)::int AS count FROM app_users WHERE email=ANY($1::text[])", [ownedEmails]).catch(() => ({ rows: [{ count: -1 }] }));
  await Promise.all(processes.map(stop));
  if (userInfoPreload) await unlink(userInfoPreload).catch(() => {});
  await pool.end();
  assert.equal(remainingPilotLearners.rows[0].count, 0, "Every uniquely identified browser pilot learner should be removed after the run");
}
