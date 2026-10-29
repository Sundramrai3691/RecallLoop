import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { Pool } from "pg";
import { chromium } from "playwright";

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
  const apiPort = await freePort(); const clientPort = await freePort();
  const apiUrl = `http://127.0.0.1:${apiPort}`; const clientUrl = `http://127.0.0.1:${clientPort}`;
  const childEnv = { ...process.env, PORT: String(apiPort), CLIENT_ORIGIN: clientUrl, LLM_PROVIDER: "mock", LLM_API_KEY: "", EMBEDDING_PROVIDER: "mock", EMBEDDING_API_KEY: "", REMEDIATION_PROVIDER: "mock" };
  const apiProcess = start("mock-provider API", [path.join(root, "node_modules/tsx/dist/cli.mjs"), "src/index.ts"], path.join(root, "server"), childEnv);
  await waitFor(`${apiUrl}/api/health`, apiProcess);
  const clientProcess = start("Vite client", [path.join(root, "node_modules/vite/bin/vite.js"), "--configLoader", "runner", "--host", "127.0.0.1", "--port", String(clientPort), "--strictPort"], path.join(root, "client"), { ...childEnv, API_PROXY_TARGET: apiUrl });
  await waitFor(clientUrl, clientProcess);
  browser = await chromium.launch({ channel: "msedge", headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const browserErrors = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("requestfailed", (request) => browserErrors.push(`${request.url()}: ${request.failure()?.errorText ?? "request failed"}`));
  await page.route("https://fonts.googleapis.com/**", (route) => route.fulfill({ status: 200, contentType: "text/css", body: "" }));
  await page.route("https://fonts.gstatic.com/**", (route) => route.fulfill({ status: 204, body: "" }));

  await page.goto(`${clientUrl}/register`, { waitUntil: "commit", timeout: 10_000 });
  await page.locator("#name").waitFor({ timeout: 10_000 });
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
  await page.locator("#material-file").setInputFiles({ name: "unsupported.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-not-parsed", "utf8") });
  await page.getByRole("alert").filter({ hasText: "PDF text extraction is not configured" }).waitFor({ timeout: 5000 });

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
  console.log(`PASS Edge Playwright core loop: register → ingest text/Markdown → DBMS assessment → diagnosis → grounded remediation → distinct verification → persisted readiness/reload; responsive dashboard and keyboard disclosure passed (${originalAttemptIds.length} assessment attempts, ${evidence.rows[0].revisions} revisions)`);
} catch (error) {
  for (const entry of processes) console.error(`${entry.name} output: ${entry.output}`);
  throw error;
} finally {
  await browser?.close().catch(() => {});
  if (userId) await pool.query("DELETE FROM app_users WHERE id=$1", [userId]).catch((error) => console.error("Could not clean up isolated pilot learner:", error.message));
  await Promise.all(processes.map(stop));
  await pool.end();
}
