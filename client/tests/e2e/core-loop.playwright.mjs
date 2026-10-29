import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { unlink, writeFile } from "node:fs/promises";
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
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const processes = [];
let browser;
let userId;
let userInfoPreload;
const browserName = process.argv.includes("--browser=firefox") ? "firefox" : process.argv.includes("--browser=edge") ? "edge" : process.env.RECALLLOOP_E2E_BROWSER ?? "edge";
assert(["edge", "firefox"].includes(browserName), `Unsupported E2E browser: ${browserName}`);
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
    const escaped = text.replace(/([\\()])/g, "\\$1");
    const stream = text ? `BT /F1 12 Tf 72 720 Td (${escaped}) Tj ET` : "";
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
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const browserErrors = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("requestfailed", (request) => browserErrors.push(`${request.url()}: ${request.failure()?.errorText ?? "request failed"}`));
  await page.route("https://fonts.googleapis.com/**", (route) => route.fulfill({ status: 200, contentType: "text/css", body: "" }));
  await page.route("https://fonts.gstatic.com/**", (route) => route.fulfill({ status: 204, body: "" }));

  await page.goto(`${clientUrl}/register`, { waitUntil: "commit", timeout: 10_000 });
  try { await page.locator("#name").waitFor({ timeout: 10_000 }); }
  catch { throw new Error(`Register screen did not render (url=${page.url()}, title=${await page.title()}, body=${JSON.stringify((await page.locator("body").innerText()).slice(0,600))}, browserErrors=${JSON.stringify(browserErrors)})`); }
  await page.locator("#name").fill("RecallLoop Core Pilot");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL("**/onboarding", { timeout: 10_000 });
  const token = await page.evaluate(() => localStorage.getItem("recallloop_token"));
  assert(token, "The supported registration flow should establish a learner session");
  userId = (await pool.query("SELECT id FROM app_users WHERE email=$1", [email])).rows[0]?.id;
  assert(userId, "The registered test learner must persist in PostgreSQL");

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

  const remediationResult = await authenticatedApi(token, `${apiUrl}/api/remediations/from-attempt/${trigger.id}`, { method: "POST", body: "{}" });
  const remediation = remediationResult.remediation;
  assert.equal(remediation.status, "ready");
  assert(remediation.sources.length > 0, "Remediation must be grounded in the learner's persisted source");
  const pdfPassage = remediation.sources.find((source) => source.sourceType === "pdf");
  assert(pdfPassage && [1, 3].includes(Number(pdfPassage.pageNumber)), "A PDF-grounded remediation excerpt must retain its original one-based page reference");
  const docxPassage = remediation.sources.find((source) => source.sourceType === "docx");
  assert(docxPassage && docxPassage.section === "Index selection" && Number(docxPassage.paragraphStart) > 0, "Grounded DOCX remediation must retain section and paragraph citations");
  await page.goto(`${clientUrl}/remediations/${remediation.id}`, { waitUntil: "domcontentloaded" });
  await page.locator(".remediation-explanation").waitFor({ timeout: 10_000 });
  await page.getByRole("button", { name: /Check what you remember/ }).click();
  await page.waitForURL(/\/recall\/[0-9a-f-]+$/i, { timeout: 10_000 });
  const verificationId = new URL(page.url()).pathname.split("/").pop();
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
  const finalRemediation = (await authenticatedApi(token, `${apiUrl}/api/remediations/${remediation.id}`)).remediation;
  assert.equal(finalRemediation.status, "verified");
  assert.equal(finalRemediation.improved, true, "The distinct verification answer should improve persisted evidence");

  await page.goto(`${clientUrl}/readiness?goalId=${goalId}`, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "My Readiness" }).waitFor();
  await page.getByText(/knowledge points have submitted evidence/).waitFor({ timeout: 10_000 });
  const readiness = await authenticatedApi(token, `${apiUrl}/api/goals/${goalId}/readiness`);
  const dbmsSkill = readiness.skills.find((skill) => skill.name === "Databases");
  assert(dbmsSkill?.assessedPoints > 0 && dbmsSkill.unassessedPoints > 0, "Readiness must show persisted assessed evidence while leaving other DBMS points unassessed");
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByText(/knowledge points have submitted evidence/).waitFor({ timeout: 10_000 });

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

  const evidence = await pool.query(`SELECT count(*)::int AS attempts, count(*) FILTER (WHERE submitted_at IS NOT NULL)::int AS submitted, count(DISTINCT canonical_question_revision_id)::int AS revisions FROM recall_attempts WHERE user_id=$1 AND id=ANY($2::uuid[])`, [userId, [...originalAttemptIds, verificationId]]);
  assert(evidence.rows[0].attempts >= originalAttemptIds.length + 1 && evidence.rows[0].submitted >= originalAttemptIds.length + 1, "The full journey's attempts must remain persisted for the isolated learner");
  assert(evidence.rows[0].revisions >= 2, "Persisted assessment and verification evidence must reference distinct revisions");
  assert.deepEqual(browserErrors, [], `Browser JavaScript errors: ${browserErrors.join("; ")}`);
  console.log(`PASS ${browserName} Playwright core loop: register, text/Markdown/PDF/DOCX with page/section citations, DOCX invalid-file state, DBMS assessment, diagnosis, grounded remediation, distinct verification, persisted readiness/reload, responsive dashboard, keyboard disclosure (${originalAttemptIds.length} assessment attempts, ${evidence.rows[0].revisions} revisions)`);
} catch (error) {
  for (const entry of processes) console.error(`${entry.name} output: ${entry.output}`);
  throw error;
} finally {
  await browser?.close().catch(() => {});
  if (userId) await pool.query("DELETE FROM app_users WHERE id=$1", [userId]).catch((error) => console.error("Could not clean up isolated pilot learner:", error.message));
  await Promise.all(processes.map(stop));
  if (userInfoPreload) await unlink(userInfoPreload).catch(() => {});
  await pool.end();
}
