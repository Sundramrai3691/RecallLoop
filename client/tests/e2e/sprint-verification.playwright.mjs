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
import { chromium, firefox } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
dotenv.config({ path: path.join(root, ".env") });
assert(process.env.DATABASE_URL, "Sprint verification E2E requires an explicitly configured loopback DATABASE_URL");
const configuredUrl = new URL(process.env.DATABASE_URL);
assert(["127.0.0.1", "localhost", "::1"].includes(configuredUrl.hostname), "Sprint verification E2E requires a loopback PostgreSQL target");
assert(/^\/recallloop$/i.test(configuredUrl.pathname), "Sprint verification E2E requires the configured recallloop database");

const browserName = process.argv.includes("--browser=firefox") ? "firefox" : "edge";
if (browserName === "firefox" && !existsSync(firefox.executablePath())) {
  throw new Error(`Playwright Firefox is not installed at ${firefox.executablePath()}`);
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      server.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

function start(name, args, cwd, env) {
  const child = spawn(process.execPath, args, { cwd, env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
  let output = "";
  const save = (chunk) => { output = `${output}${chunk}`.slice(-6000); };
  child.stdout.on("data", save);
  child.stderr.on("data", save);
  return { name, child, get output() { return output; } };
}

async function waitFor(url, processEntry) {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if (processEntry.child.exitCode !== null) throw new Error(`${processEntry.name} exited: ${processEntry.output}`);
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(800) });
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 120));
  }
  throw new Error(`${processEntry.name} did not serve ${url}: ${processEntry.output}`);
}

async function stop(processEntry) {
  if (processEntry.child.exitCode !== null || processEntry.child.signalCode !== null) return;
  processEntry.child.kill("SIGTERM");
  await Promise.race([
    new Promise((resolve) => processEntry.child.once("exit", resolve)),
    new Promise((resolve) => setTimeout(resolve, 3000)),
  ]);
}

async function authenticatedApi(token, url, init = {}) {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init.headers ?? {}),
    },
  });
  const body = await response.json();
  assert(response.ok, `${init.method ?? "GET"} ${url} failed: ${JSON.stringify(body)}`);
  return body;
}

const random = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const maintenanceUrl = new URL(configuredUrl);
maintenanceUrl.pathname = "/postgres";
const databaseName = `recallloop_sprint_v1c_${random().replace(/[^a-z0-9]/gi, "").slice(0, 20)}`;
const isolatedUrl = new URL(configuredUrl);
isolatedUrl.pathname = `/${databaseName}`;
const maintenance = new Pool({ connectionString: maintenanceUrl.toString() });
const processes = [];
let browser;
let browserContext;
let page;
let createdDatabase = false;
let userInfoPreload;
const ownedEmails = [];
const pageErrors = [];
const failedRequests = [];
const consoleErrors = [];

async function runNpm(args, env) {
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [process.env.npm_execpath, ...args], {
      cwd: root,
      env,
      windowsHide: true,
      stdio: "inherit",
    });
    child.once("exit", (code) => code === 0 ? resolve() : reject(new Error(`npm ${args.join(" ")} exited ${code}`)));
  });
}

try {
  await maintenance.query(`CREATE DATABASE "${databaseName}"`);
  createdDatabase = true;
  const childEnv = {
    ...process.env,
    DATABASE_URL: isolatedUrl.toString(),
    LLM_PROVIDER: "mock",
    LLM_API_KEY: "",
    EMBEDDING_PROVIDER: "mock",
    EMBEDDING_API_KEY: "",
    REMEDIATION_PROVIDER: "mock",
  };
  await runNpm(["run", "db:migrate", "-w", "server"], childEnv);
  await runNpm(["run", "db:seed", "-w", "server"], childEnv);
  await runNpm(["run", "question-bank:automated-review", "-w", "server", "--", "--apply"], childEnv);

  const apiPort = await freePort();
  const clientPort = await freePort();
  const apiUrl = `http://127.0.0.1:${apiPort}`;
  const clientUrl = `http://127.0.0.1:${clientPort}`;

  userInfoPreload = path.join(tmpdir(), `recallloop-sprint-v1c-${process.pid}.cjs`);
  await writeFile(userInfoPreload, "const os=require('node:os');const original=os.userInfo;os.userInfo=()=>{try{return original()}catch{return {uid:-1,gid:-1,username:'local-user',homedir:os.homedir(),shell:''}}};", "ascii");
  const preloadArgument = `--require="${userInfoPreload.replaceAll("\\", "/")}"`;
  const apiEnv = {
    ...childEnv,
    PORT: String(apiPort),
    CLIENT_ORIGIN: clientUrl,
    NODE_OPTIONS: [process.env.NODE_OPTIONS, preloadArgument].filter(Boolean).join(" "),
  };
  const apiProcess = start("Sprint verification API", [path.join(root, "node_modules/tsx/dist/cli.mjs"), "src/index.ts"], path.join(root, "server"), apiEnv);
  processes.push(apiProcess);
  await waitFor(`${apiUrl}/api/health`, apiProcess);

  const clientProcess = start(
    "Sprint verification Vite preview",
    [path.join(root, "node_modules/vite/bin/vite.js"), "preview", "--configLoader", "runner", "--host", "127.0.0.1", "--port", String(clientPort), "--strictPort"],
    path.join(root, "client"),
    { ...childEnv, API_PROXY_TARGET: apiUrl },
  );
  processes.push(clientProcess);
  await waitFor(clientUrl, clientProcess);

  const isolated = new Pool({ connectionString: isolatedUrl.toString() });
  let testUserId;
  try {
    const email = `e2e-sprint-verification-${random()}@test.local`;
    ownedEmails.push(email);
    const password = `SprintV1C-${random()}`;
    const registerResponse = await fetch(`${apiUrl}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Sprint Verification Pilot", email, password }),
    });
    const auth = await registerResponse.json();
    assert(registerResponse.ok, `Could not register fixture learner: ${JSON.stringify(auth)}`);
    testUserId = auth.user.id;
    const token = auth.token;
    const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

    const coverage = await authenticatedApi(token, `${apiUrl}/api/assessments/coverage`);
    const concept = coverage.subjects.flatMap((subject) => subject.topics.flatMap((topic) => topic.concepts))
      .find((item) => item.supportedModes.includes("rapid_fire") && item.name === "HTTP caching");
    assert(concept, "Disposable DB must have an eligible HTTP caching Rapid Fire concept");

    const assessmentResponse = await fetch(`${apiUrl}/api/assessments`, {
      method: "POST",
      headers,
      body: JSON.stringify({ canonicalConceptId: concept.id, mode: "rapid_fire" }),
    });
    const assessment = await assessmentResponse.json();
    assert(assessmentResponse.ok, `Could not create Sprint fixture assessment: ${JSON.stringify(assessment)}`);
    assert.equal(assessment.questions.length, 5);
    const firstAttempt = assessment.questions[0];
    const studySessionId = firstAttempt.studySessionId;

    const sourceResponse = await fetch(`${apiUrl}/api/grounding/sources`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        title: "HTTP caching Sprint verification source",
        text: "HTTP caching stores responses for reuse. no-store prevents storing a response in a cache. no-cache requires validation before reuse. ETag and Last-Modified are validators. A no-store directive has different behavior from no-cache.",
        sourceType: "text",
        reference: "Test fixture HTTP caching source",
        provenance: { submittedBy: "learner", attribution: "Disposable Sprint verification fixture" },
      }),
    });
    const source = await sourceResponse.json();
    assert(sourceResponse.ok, `Could not create fixture source: ${JSON.stringify(source)}`);
    await isolated.query(
      `UPDATE study_sessions SET grounding_source_id=$2,raw_material=$3,source_url=NULL,updated_at=now() WHERE id=$1 AND user_id=$4`,
      [studySessionId, source.source.id, "HTTP caching stores responses. no-store prevents storage; no-cache requires validation.", testUserId],
    );
    await isolated.query(
      `INSERT INTO review_states(user_id,concept_id,state,due_at,interval_days,stability,difficulty,last_recall_at,last_outcome,consecutive_successes)
       SELECT r.user_id,r.concept_id,'review',now()-interval '1 hour',1,1,.3,NULL,NULL,0
       FROM recall_attempts r WHERE r.id=$1
       ON CONFLICT(user_id,concept_id) DO UPDATE SET due_at=now()-interval '1 hour',updated_at=now()`,
      [firstAttempt.id],
    );

    browser = await (browserName === "firefox" ? firefox.launch({ headless: true }) : chromium.launch({ channel: "msedge", headless: true }));
    browserContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await browserContext.addInitScript((token) => localStorage.setItem("recallloop_token", token), token);
    await browserContext.tracing.start({ screenshots: true, snapshots: true, sources: true });
    page = await browserContext.newPage();
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
    page.on("requestfailed", (request) => failedRequests.push(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? ""}`));

    await page.goto(`${clientUrl}/dashboard`, { waitUntil: "domcontentloaded", timeout: 20_000 });
    await page.getByRole("link", { name: "Start Sprint", exact: true }).click();
    await page.waitForURL(/\/sprint$/, { timeout: 10_000 });
    await page.getByRole("button", { name: "Start Recall Sprint" }).click();
    await page.waitForURL(/\/sprint\/[0-9a-f-]+$/i, { timeout: 10_000 });
    const sprintId = new URL(page.url()).pathname.split("/").pop();

    await page.getByRole("link", { name: "Answer", exact: true }).first().click();
    await page.waitForURL(/\/recall\/[0-9a-f-]+/, { timeout: 10_000 });
    const weakAttemptId = new URL(page.url()).pathname.split("/").pop();
    const recallPage = await authenticatedApi(token, `${apiUrl}/api/recalls/${weakAttemptId}`);
    const weakAttempt = recallPage.recall ?? recallPage.attempt ?? recallPage;
    if (weakAttempt.questionType === "mcq") {
      const wrong = weakAttempt.questionData.options.find((option) => option.id !== weakAttempt.questionData.correctOptionId);
      assert(wrong, "Weak verification fixture needs a wrong MCQ option");
      await page.locator("label.option").filter({ hasText: wrong.text }).locator("input").check();
    } else {
      await page.locator("#answer").fill("I do not know the distinction between no-cache and no-store.");
    }
    await page.waitForFunction((prompt) => {
      const answer = document.querySelector("#answer");
      if (answer instanceof HTMLTextAreaElement) return answer.value.trim().length > 0 && document.querySelector("form.card button[type='submit']")?.disabled === false;
      return document.querySelector("input[name='option']:checked") !== null;
    }, null, { timeout: 5_000 });
    const weakSubmitResponse = page.waitForResponse((response) =>
      response.request().method() === "POST"
      && response.url().includes(`/api/recalls/${weakAttemptId}/submit`),
    );
    await page.locator("form.card button[type='submit']").click();
    const weakResponse = await weakSubmitResponse;
    assert.equal(weakResponse.status(), 200);
    await page.waitForURL(/\/recall\/[0-9a-f-]+\/result(?:\?|$)/i, { timeout: 10_000 });
    await page.getByRole("heading", { name: "HTTP caching", exact: true }).waitFor({ timeout: 10_000 });
    await page.getByRole("link", { name: "Done for now" }).click();
    await page.waitForURL(new RegExp(`/sprint/${sprintId}$`, "i"), { timeout: 10_000 });

    await page.getByRole("button", { name: "Open focused repair" }).click();
    await page.waitForURL(/\/remediations\/[0-9a-f-]+/i, { timeout: 10_000 });
    const remediationId = new URL(page.url()).pathname.split("/").pop();
    await page.locator(".remediation-explanation").waitFor({ timeout: 10_000 });
    await page.locator(".source-excerpt").first().waitFor({ timeout: 10_000 });

    await page.getByRole("button", { name: "Check what you remember" }).click();
    await page.waitForURL(/\/recall\/[0-9a-f-]+(?:\?|$)/i, { timeout: 10_000 });
    const verificationAttemptId = new URL(page.url()).pathname.split("/")[3] ?? new URL(page.url()).pathname.split("/").pop();
    const verification = await authenticatedApi(token, `${apiUrl}/api/recalls/${verificationAttemptId}`);
    const verificationAttempt = verification.recall ?? verification.attempt ?? verification;
    assert(verificationAttempt.id);
    assert.notEqual(verificationAttempt.id, weakAttemptId);
    assert(verificationAttempt.canonicalQuestionRevisionId);
    assert.notEqual(verificationAttempt.canonicalQuestionRevisionId, weakAttempt.canonicalQuestionRevisionId);

    if (verificationAttempt.questionType === "mcq") {
      const answerKey = (await isolated.query("SELECT correct_option_id FROM canonical_question_revisions WHERE id=$1", [verificationAttempt.canonicalQuestionRevisionId])).rows[0]?.correct_option_id;
      const choice = verificationAttempt.questionData.options.find((option) => option.id === answerKey);
      assert(choice, "Verification MCQ must expose a real option for its persisted key");
      await page.locator("label.option").filter({ hasText: choice.text }).locator("input").check();
    } else if (verificationAttempt.questionData?.parts?.length) {
      for (const part of verificationAttempt.questionData.parts) {
        await page.locator(`#answer-${part.id}`).fill("no-cache requires validation before reuse; no-store prevents storing the response.");
      }
    } else {
      await page.locator("#answer").fill("no-cache requires validation before reuse; no-store prevents storing the response.");
    }

    await page.waitForFunction(() => {
      const submit = document.querySelector("form.card button[type='submit']");
      if (!(submit instanceof HTMLButtonElement)) return false;
      if (!submit.disabled) {
        const textareas = [...document.querySelectorAll("textarea")];
        if (textareas.length) return textareas.every((textarea) => textarea.value.trim().length > 0);
        return true;
      }
      return false;
    }, null, { timeout: 5_000 });

    const submitPromise = page.waitForResponse((response) =>
      response.request().method() === "POST"
      && response.url().includes(`/api/recalls/${verificationAttemptId}/submit`),
    );
    await page.locator("form.card button[type='submit']").click();
    const submissionResponse = await submitPromise;
    assert.equal(submissionResponse.status(), 200);
    await page.waitForURL(/\/recall\/[0-9a-f-]+\/result(?:\?|$)/i, { timeout: 10_000 });
    await page.getByRole("link", { name: "Done for now" }).click();
    await page.waitForURL(new RegExp(`/sprint/${sprintId}$`, "i"), { timeout: 10_000 });
    await page.reload({ waitUntil: "domcontentloaded" });

    const sprintRead = await authenticatedApi(token, `${apiUrl}/api/sprints/${sprintId}`);
    assert.equal(sprintRead.sprint.verificationAttemptId, verificationAttemptId);
    const remediationRead = await authenticatedApi(token, `${apiUrl}/api/remediations/${remediationId}`);
    assert.equal(remediationRead.remediation.status, "verified");
    assert.equal(remediationRead.remediation.verificationAttemptId, verificationAttemptId);
    assert(remediationRead.remediation.sources.length > 0);
    assert(remediationRead.remediation.sources.some((source) => source.reference || source.pageNumber || source.section));

    await browserContext.tracing.stop({ path: path.join(root, "test-results", "sprint-verification.trace.zip") });
    await page.screenshot({ path: path.join(root, "test-results", "sprint-verification-success-1440.png"), fullPage: true });
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.screenshot({ path: path.join(root, "test-results", "sprint-verification-success-768.png"), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: path.join(root, "test-results", "sprint-verification-success-390.png"), fullPage: true });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    assert.equal(overflow, false);

    const evidence = await isolated.query(
      `SELECT r.id,r.canonical_question_revision_id,r.submitted_at,e.overall_coverage
       FROM recall_attempts r LEFT JOIN recall_evaluations e ON e.recall_attempt_id=r.id
       WHERE r.id=ANY($1::uuid[])`,
      [[weakAttemptId, verificationAttemptId]],
    );
    assert.equal(evidence.rows.length, 2);
    assert(evidence.rows.every((row) => row.submitted_at));
    console.log(JSON.stringify({
      passed: true,
      weakAttemptId,
      verificationAttemptId,
      weakRevisionId: weakAttempt.canonicalQuestionRevisionId,
      verificationRevisionId: verificationAttempt.canonicalQuestionRevisionId,
      remediationId,
      sprintId,
    }));
  } finally {
    if (browserContext) await browserContext.tracing.stop().catch(() => {});
    if (browser) await browser.close().catch(() => {});
    if (testUserId) await isolated.query("DELETE FROM app_users WHERE id=$1", [testUserId]).catch(() => {});
    await isolated.end();
  }
} catch (error) {
  const artifactDir = path.join(root, "test-results");
  await mkdir(artifactDir, { recursive: true }).catch(() => {});
  if (page) {
    await page.screenshot({ path: path.join(artifactDir, "sprint-verification-failure.png"), fullPage: true }).catch(() => {});
    const state = await page.evaluate(() => ({
      url: location.href,
      heading: document.querySelector("h1")?.textContent ?? null,
      body: document.body.innerText.slice(-1800),
    })).catch(() => null);
    console.error(JSON.stringify({ browserState: state, pageErrors, consoleErrors, failedRequests }, null, 2));
  }
  if (browserContext) await browserContext.tracing.stop({ path: path.join(artifactDir, "sprint-verification-failure.trace.zip") }).catch(() => {});
  if (pageErrors.length || consoleErrors.length || failedRequests.length) {
    console.error(JSON.stringify({ pageErrors, consoleErrors, failedRequests }, null, 2));
  }
  throw error;
} finally {
  for (const processEntry of processes) await stop(processEntry);
  if (userInfoPreload) await unlink(userInfoPreload).catch(() => {});
  if (createdDatabase) {
    await maintenance.query("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1 AND pid <> pg_backend_pid()", [databaseName]);
    await maintenance.query(`DROP DATABASE IF EXISTS "${databaseName}"`);
  }
  await maintenance.end();
}
