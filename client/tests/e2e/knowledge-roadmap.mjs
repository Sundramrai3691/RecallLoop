import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "node:net";
import dotenv from "dotenv";
import { Pool } from "pg";
import { Builder, By, until, Select } from "selenium-webdriver";
import firefox from "selenium-webdriver/firefox.js";
import { start as startGeckodriver } from "geckodriver";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const require = createRequire(import.meta.url);
const seleniumVersion = require("selenium-webdriver/package.json").version;
dotenv.config({ path: path.join(root, ".env") });

async function findFreePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Could not allocate a loopback port for E2E.");
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return address.port;
}

const databaseUrl = new URL(process.env.DATABASE_URL ?? "");
assert(["127.0.0.1", "localhost", "::1"].includes(databaseUrl.hostname), "E2E cleanup is restricted to a loopback PostgreSQL host");
const isolatedRun = process.env.RECALLLOOP_E2E_ISOLATED === "1";
assert(isolatedRun ? /^\/recallloop_u2_it_[a-f0-9]{16}$/.test(databaseUrl.pathname) : databaseUrl.pathname === "/recallloop", "E2E cleanup is restricted to the local recallloop database or the U2 disposable test database");

const email = `e2e-roadmap-${Date.now()}-${Math.random().toString(16).slice(2)}@test.local`;
const password = `E2e-${Math.random().toString(36).slice(2)}-${Date.now()}`;
let foreignAccountEmail;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const geckodriverVersion = "0.37.1";
const firefoxBinary = process.env.RECALLLOOP_FIREFOX_BINARY ?? "C:\\Program Files\\Mozilla Firefox\\firefox.exe";
const firefoxVersionResult = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", "(Get-Item -LiteralPath $env:RECALLLOOP_FIREFOX_BINARY).VersionInfo.FileVersion"], {
  encoding: "utf8",
  timeout: 15000,
  windowsHide: true,
  env: { ...process.env, RECALLLOOP_FIREFOX_BINARY: firefoxBinary },
});
if (firefoxVersionResult.error || firefoxVersionResult.status !== 0) {
  throw new Error(`Could not inspect Firefox executable metadata at ${firefoxBinary}: ${firefoxVersionResult.error?.message ?? firefoxVersionResult.stderr}`);
}
const firefoxVersion = firefoxVersionResult.stdout.match(/(\d+)\.(\d+)(?:\.(\d+))?/);
if (!firefoxVersion) throw new Error(`Could not parse Firefox executable version at ${firefoxBinary}: ${firefoxVersionResult.stdout.trim()}`);
const firefoxVersionLabel = `${firefoxVersion[1]}.${firefoxVersion[2]}${firefoxVersion[3] ? `.${firefoxVersion[3]}` : ""}`;
if (Number(firefoxVersion[1]) < 115) {
  throw new Error(`Firefox ${firefoxVersionLabel} at ${firefoxBinary} is unsupported by geckodriver ${geckodriverVersion}; install Firefox 115 ESR or newer, or use npm run test:e2e for the Edge/Playwright default.`);
}
const options = new firefox.Options().setBinary(firefoxBinary).addArguments("-headless");
const apiPort = await findFreePort();
const clientPort = await findFreePort();
const driverPort = await findFreePort();
const apiUrl = `http://127.0.0.1:${apiPort}`;
const clientUrl = `http://127.0.0.1:${clientPort}`;
const processes = [];
let geckodriver;
let driver;

function startNodeProcess(name, args, cwd, env) {
  const child = spawn(process.execPath, args, { cwd, env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
  let output = "";
  const collect = (chunk) => { output = `${output}${chunk}`.slice(-5000); };
  child.stdout.on("data", collect);
  child.stderr.on("data", collect);
  const processInfo = { name, child, get output() { return output; } };
  processes.push(processInfo);
  return processInfo;
}

async function waitForUrl(url, processInfo, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (processInfo.child.exitCode !== null) throw new Error(`${processInfo.name} exited before becoming ready:\n${processInfo.output}`);
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1000) });
      if (response.ok) return;
    } catch {
      // The child process is still starting its listener.
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`${processInfo.name} did not serve ${url} within ${timeoutMs}ms:\n${processInfo.output}`);
}

async function stopProcess(processInfo) {
  const { child } = processInfo;
  if (child.exitCode !== null || child.signalCode !== null) return;
  child.kill("SIGTERM");
  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    new Promise((resolve) => setTimeout(resolve, 3000)),
  ]);
  if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
}

async function waitForDriver(port) {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/status`);
      if (response.ok) return;
    } catch {
      // The driver process is still opening its local port.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Geckodriver did not become ready within 10 seconds");
}

async function chooseSelectValue(driverInstance, id, value) {
  const select = await driverInstance.findElement(By.id(id));
  await new Select(select).selectByValue(value);
}

try {
  console.log(`E2E isolated ports: API ${apiPort}, client ${clientPort}, Firefox driver ${driverPort}`);
  const childEnv = {
    ...process.env,
    PORT: String(apiPort),
    CLIENT_ORIGIN: clientUrl,
    LLM_PROVIDER: "mock",
    LLM_API_KEY: "",
    EMBEDDING_PROVIDER: "mock",
    EMBEDDING_API_KEY: "",
    REMEDIATION_PROVIDER: "mock",
  };
  const apiProcess = startNodeProcess("mock-provider API", [path.join(root, "node_modules/tsx/dist/cli.mjs"), "src/index.ts"], path.join(root, "server"), childEnv);
  await waitForUrl(`${apiUrl}/api/health`, apiProcess);
  const health = await (await fetch(`${apiUrl}/api/health`)).json();
  assert.equal(health.mockLlm, true, "E2E must use the deterministic local evaluator");

  const clientProcess = startNodeProcess("Vite client", [
    path.join(root, "node_modules/vite/bin/vite.js"),
    "--configLoader", "runner", "--host", "127.0.0.1", "--port", String(clientPort), "--strictPort",
  ], path.join(root, "client"), { ...childEnv, API_PROXY_TARGET: apiUrl });
  await waitForUrl(clientUrl, clientProcess);

  console.log(`Firefox binary: ${firefoxBinary} (${firefoxVersionLabel}); geckodriver: ${geckodriverVersion}; Selenium: ${seleniumVersion}`);
  geckodriver = await startGeckodriver({ host: "127.0.0.1", port: driverPort, geckoDriverVersion: geckodriverVersion });
  await waitForDriver(driverPort);
  driver = await new Builder().usingServer(`http://127.0.0.1:${driverPort}`).forBrowser("firefox").setFirefoxOptions(options).build();
  const firefoxCapabilities = await driver.getCapabilities();
  console.log(`Firefox session browserVersion=${firefoxCapabilities.get("browserVersion")}; moz:debuggerAddress=${firefoxCapabilities.get("moz:debuggerAddress") ?? "omitted"}`);
  assert.notEqual(firefoxCapabilities.get("moz:debuggerAddress"), true, "This test does not use Selenium's Firefox CDP debugger connection");
  await driver.manage().setTimeouts({ implicit: 0, pageLoad: 45000, script: 10000 });
  console.log("PASS Firefox WebDriver session handshake");
  const registration = await fetch(`${apiUrl}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "RecallLoop E2E", email, password }),
  });
  const registeredLearner = await registration.json();
  assert.equal(registration.status, 201, `Could not create the disposable learner through the application API: ${JSON.stringify(registeredLearner)}`);
  const token = registeredLearner.token;
  console.log("PASS disposable learner registration");
  console.log(`Firefox first application navigation: ${clientUrl}`);
  await driver.get(clientUrl);
  await driver.executeScript("localStorage.setItem('recallloop_token', arguments[0])", token);

  const screenshotDirectory = path.join(os.tmpdir(), `recallloop-ux-${new Date().toISOString().slice(0, 10)}`);
  await mkdir(screenshotDirectory, { recursive: true });
  await driver.manage().window().setRect({ width: 1440, height: 985, x: 0, y: 0 });
  await driver.get(clientUrl);
  await driver.wait(until.elementLocated(By.css(".constellation")), 10000);
  await new Promise((resolve) => setTimeout(resolve, 650));
  await writeFile(path.join(screenshotDirectory, "landing-desktop.png"), Buffer.from(await driver.takeScreenshot(), "base64"));
  const initialTheme = await driver.executeScript("return document.documentElement.dataset.theme");
  if (initialTheme !== "light") await driver.findElement(By.css("button[aria-label='Switch to light theme']")).click();
  await driver.wait(async () => (await driver.executeScript("return document.documentElement.dataset.theme")) === "light", 3000);
  await new Promise((resolve) => setTimeout(resolve, 150));
  await writeFile(path.join(screenshotDirectory, "landing-light.png"), Buffer.from(await driver.takeScreenshot(), "base64"));
  if (initialTheme !== "light") await driver.findElement(By.css("button[aria-label='Switch to dark theme']")).click();
  await driver.wait(async () => (await driver.executeScript("return document.documentElement.dataset.theme")) === initialTheme, 3000);
  await driver.get(`${clientUrl}/dashboard`);
  await driver.wait(until.elementLocated(By.css(".sidebar")), 10000);
  await driver.wait(until.elementLocated(By.xpath("//h1[contains(.,'What would you like to do?') or contains(.,'Choose your next learning step')]")), 10000);
  for (const label of ["Test my knowledge", "Learn something new", "Review and improve"]) {
    assert.ok(await driver.findElement(By.xpath(`//h2[normalize-space()='${label}']`)), `Home should keep the ${label} entry point visible`);
  }
  const homeReadinessLink = await driver.findElement(By.css(".home-utilities a[href='/readiness']"));
  await homeReadinessLink.click();
  await driver.wait(until.elementLocated(By.xpath("//h1[normalize-space()='My Readiness']")), 10000);
  await driver.wait(until.elementLocated(By.xpath("//h3[normalize-space()='Readiness starts with a goal']")), 10000);
  assert.equal(new URL(await driver.getCurrentUrl()).pathname, "/readiness", "A learner without goals should reach the readiness page directly without an assessment or roadmap handoff");
  await driver.get(`${clientUrl}/dashboard`);
  await driver.wait(until.elementLocated(By.xpath("//h1[contains(.,'What would you like to do?') or contains(.,'Choose your next learning step')]")), 10000);
  for (const viewport of [{ width: 1440, height: 900 }, { width: 1024, height: 768 }, { width: 390, height: 844 }]) {
    await driver.manage().window().setRect({ width: viewport.width, height: viewport.height + 85, x: 0, y: 0 });
    await driver.wait(async () => (await driver.executeScript("return window.innerWidth")) > 0, 3000);
    await new Promise((resolve) => setTimeout(resolve, 250));
    const renderedViewport = await driver.executeScript("return { width: window.innerWidth, height: window.innerHeight }");
    assert.ok(Math.abs(renderedViewport.width - viewport.width) <= (viewport.width === 390 ? 64 : 24), `Browser CSS width ${renderedViewport.width} should be close to requested ${viewport.width}`);
    const overflow = await driver.executeScript("return document.documentElement.scrollWidth > window.innerWidth");
    assert.equal(overflow, false, `Dashboard should not overflow at ${renderedViewport.width}x${renderedViewport.height} (requested ${viewport.width}x${viewport.height})`);
    if (viewport.width === 1440 || viewport.width === 390) {
      const name = viewport.width === 1440 ? "dashboard-desktop.png" : "dashboard-mobile.png";
      await writeFile(path.join(screenshotDirectory, name), Buffer.from(await driver.takeScreenshot(), "base64"));
    }
    console.log(`Dashboard viewport check: requested ${viewport.width}x${viewport.height}, rendered CSS ${renderedViewport.width}x${renderedViewport.height}`);
  }
  await driver.manage().window().setRect({ width: 1440, height: 985, x: 0, y: 0 });
  await new Promise((resolve) => setTimeout(resolve, 250));

  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    const token = await driver.executeScript("return localStorage.getItem('recallloop_token')");
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
    await context.addInitScript((authToken) => localStorage.setItem("recallloop_token", authToken), token);
    const page = await context.newPage();
    for (const viewport of [{ width: 1440, height: 900 }, { width: 768, height: 1024 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport);
      await page.goto(`${clientUrl}/dashboard`, { waitUntil: "networkidle" });
      await page.getByRole("heading", { name: /What would you like to do\?|Choose your next learning step/ }).waitFor();
      const metrics = await page.evaluate(() => ({ width: innerWidth, height: innerHeight, scrollWidth: document.documentElement.scrollWidth }));
      assert.deepEqual([metrics.width, metrics.height], [viewport.width, viewport.height], "Playwright must render the requested CSS viewport exactly");
      assert.ok(metrics.scrollWidth <= viewport.width, `Home should not overflow at ${viewport.width}x${viewport.height}; scroll width was ${metrics.scrollWidth}`);
      if (viewport.width === 1440 || viewport.width === 390) await page.screenshot({ path: path.join(screenshotDirectory, `home-${viewport.width}.png`), fullPage: true });
      console.log(`Playwright viewport check: exact ${metrics.width}x${metrics.height}, no horizontal overflow`);
    }
    for (const label of ["Test my knowledge", "Learn something new", "Review and improve"]) await page.getByRole("heading", { name: label, level: 2 }).waitFor();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${clientUrl}/study/new`, { waitUntil: "networkidle" });
    await page.getByRole("heading", { name: "What would you like to learn?" }).waitFor();
    await page.screenshot({ path: path.join(screenshotDirectory, "study-setup-390.png"), fullPage: true });
    await page.goto(`${clientUrl}/plan/today`, { waitUntil: "networkidle" });
    await page.getByRole("heading", { name: "A learning journey for today" }).waitFor();
    const planWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    assert.ok(planWidth <= 390, `Today’s plan should not overflow at 390px; scroll width was ${planWidth}`);
    await page.screenshot({ path: path.join(screenshotDirectory, "plan-empty-390.png"), fullPage: true });
    await page.goto(`${clientUrl}/knowledge-check`, { waitUntil: "networkidle" });
    await page.getByRole("heading", { name: "What would you like to check?" }).waitFor();
    const knowledgeCheckWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    assert.ok(knowledgeCheckWidth <= 390, `Knowledge Check should not overflow at 390px; scroll width was ${knowledgeCheckWidth}`);
    await page.screenshot({ path: path.join(screenshotDirectory, "knowledge-check-390.png"), fullPage: true });
    await context.close();
  } finally { await browser.close(); }

  // Journey A begins with the live canonical catalog. Coverage-gated topics remain disabled;
  // if a fully supported blueprint exists, complete it through the existing assessment engine.
  await driver.get(`${clientUrl}/knowledge-check`);
  await driver.wait(until.elementLocated(By.id("knowledge-subject")), 10000);
  const coverageSnapshot = await driver.executeAsyncScript(async (done) => {
    try {
    const token = localStorage.getItem("recallloop_token");
    const response = await fetch("/api/assessments/coverage", { headers: { Authorization: `Bearer ${token}` } });
    done({ status: response.status, body: await response.json() });
    } catch (error) {
      done({ networkError: String(error) });
    }
  });
  assert.equal(coverageSnapshot.status, 200, "Knowledge check must load database-backed coverage");
  assert.ok(coverageSnapshot.body.subjects.length > 0, "The seeded canonical subject taxonomy should be available");
  let canonicalAssessmentState = null;
  let canonicalDbmsAssessmentState = null;
  const allCatalogConcepts = coverageSnapshot.body.subjects.flatMap((subject) => subject.topics.flatMap((topic) => topic.concepts.map((concept) => ({ subject, topic, concept }))));
  const unsupportedConcept = allCatalogConcepts.find(({ concept }) => concept.supportedModes.length === 0);
  if (unsupportedConcept) {
    await chooseSelectValue(driver, "knowledge-subject", unsupportedConcept.subject.id);
    await chooseSelectValue(driver, "knowledge-topic", unsupportedConcept.topic.id);
    const conceptChoices = await driver.findElements(By.css("input[name='concept']"));
    let selectedUnsupported = false;
    for (const choice of conceptChoices) {
      const label = await choice.findElement(By.xpath("ancestor::label"));
      if ((await label.getText()).includes(unsupportedConcept.concept.name)) { await choice.click(); selectedUnsupported = true; break; }
    }
    assert.equal(selectedUnsupported, true, "The insufficient-coverage concept should be selectable for inspection");
    await driver.wait(until.elementLocated(By.xpath("//*[contains(.,'No assessment questions yet') or contains(.,'needs review') or contains(.,'need review') or contains(.,'aren’t enough approved questions')]")), 5000);
    assert.equal(await driver.findElement(By.xpath("//button[contains(.,'Start knowledge check')]")).isEnabled(), false, "The application must not promise unsupported coverage");
    assert.ok(await driver.findElement(By.linkText("Learn this topic")), "Insufficient coverage should link to study");
    const rejectedKnowledgeCheck = await driver.executeAsyncScript(async (conceptId, done) => {
      const token = localStorage.getItem("recallloop_token");
      const response = await fetch("/api/assessments", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ canonicalConceptId: conceptId, mode: "practice" }) });
      done({ status: response.status, body: await response.json() });
    }, unsupportedConcept.concept.id);
    assert.equal(rejectedKnowledgeCheck.status, 409, "The server must reject a check without a complete approved blueprint");
    assert.equal(rejectedKnowledgeCheck.body.code, "QUESTION_BANK_COVERAGE_INSUFFICIENT");
    const userIdForCoverage = (await pool.query("SELECT id FROM app_users WHERE email=$1", [email])).rows[0].id;
    const writesAfterCoverageRejection = await pool.query(`SELECT (SELECT count(*)::int FROM study_sessions WHERE user_id=$1 AND title LIKE 'Knowledge check:%') AS sessions,(SELECT count(*)::int FROM assessment_sessions WHERE user_id=$1) AS assessments`, [userIdForCoverage]);
    assert.deepEqual(writesAfterCoverageRejection.rows[0], { sessions: 0, assessments: 0 }, "A blocked knowledge check must not leave a partial learner record");
    console.log("PASS knowledge-check coverage gate: unsupported topic stays disabled and creates no learner records");
  }
  const supportedConcept = allCatalogConcepts.find(({ concept }) => concept.supportedModes.length > 0);
  if (supportedConcept) {
    await chooseSelectValue(driver, "knowledge-subject", supportedConcept.subject.id);
    await chooseSelectValue(driver, "knowledge-topic", supportedConcept.topic.id);
    const conceptChoices = await driver.findElements(By.css("input[name='concept']"));
    for (const choice of conceptChoices) {
      if ((await choice.findElement(By.xpath("ancestor::label")).getText()).includes(supportedConcept.concept.name)) { await choice.click(); break; }
    }
    const mode = supportedConcept.concept.supportedModes[0];
    const modeChoice = await driver.findElement(By.css(`input[name='assessment-mode'][value='${mode}']`)).catch(async () => {
      const inputs = await driver.findElements(By.css("input[name='assessment-mode']")); return inputs[0];
    });
    await driver.executeScript("arguments[0].scrollIntoView({block:'center'});", modeChoice);
    await modeChoice.click();
    await driver.findElement(By.xpath("//button[contains(.,'Start knowledge check')]")).click();
    await driver.wait(until.urlContains("/assessments/"), 10000);
    const assessmentId = new URL(await driver.getCurrentUrl()).pathname.split("/").at(-1);
    const assessmentInitial = await driver.executeAsyncScript(async (id, done) => {
      const token = localStorage.getItem("recallloop_token");
      const response = await fetch(`/api/assessments/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      done({ status: response.status, body: await response.json() });
    }, assessmentId);
    assert.equal(assessmentInitial.status, 200);
    assert.ok(assessmentInitial.body.questions.every((question) => question.canonicalQuestionRevisionId), "Knowledge checks must preserve immutable canonical question revision links");
    assert.equal(assessmentInitial.body.questions.length, 5, "Rapid Fire must materialize the complete five-question blueprint");
    assert.deepEqual(assessmentInitial.body.questions.map((question) => question.questionType).sort(), ["mcq", "mcq", "rapid_recall", "rapid_recall", "rapid_recall"].sort());
    assert.ok(assessmentInitial.body.questions.every((question) => !Object.hasOwn(question.questionData, "explanation") && !Object.hasOwn(question.questionData, "rubric")), "Expected answers and explanations must stay hidden before each answer is submitted");
    assert.equal(new Set(assessmentInitial.body.questions.map((question) => question.canonicalQuestionRevisionId)).size, 5, "An assessment must not repeat a revision within its blueprint");
    const rapidIntro = await driver.wait(until.elementLocated(By.xpath("//button[contains(.,'Start Rapid Fire')]")), 10000);
    await driver.wait(until.elementIsVisible(rapidIntro), 5000);
    await writeFile(path.join(screenshotDirectory, "assessment-intro.png"), Buffer.from(await driver.takeScreenshot(), "base64"));
    await rapidIntro.click();
    await driver.wait(until.elementLocated(By.css(".question-card")), 10000);
    await writeFile(path.join(screenshotDirectory, "assessment-question.png"), Buffer.from(await driver.takeScreenshot(), "base64"));
    for (let index = 0; index < assessmentInitial.body.questions.length; index += 1) {
      const currentQuestion = assessmentInitial.body.questions[index];
      await driver.wait(until.elementLocated(By.css(".question-card")), 10000);
      const radios = await driver.findElements(By.css(".question-card input[type='radio']"));
      if (radios.length) {
        const key = await pool.query("SELECT correct_option_id FROM canonical_question_revisions WHERE id=$1", [currentQuestion.canonicalQuestionRevisionId]);
        const wrongIndex = currentQuestion.questionData.options.findIndex((option) => option.id !== key.rows[0]?.correct_option_id);
        if (wrongIndex >= 0) await radios[wrongIndex].click();
        else await radios[0].click();
      }
      else {
        const textareas = await driver.findElements(By.css(".question-card textarea"));
        for (const textarea of textareas) await textarea.sendKeys("I would explain the idea and connect it to the evidence in the question.");
      }
      const priorLabel = await driver.findElement(By.css(".assessment-progress .eyebrow")).getText().catch(() => "");
      await driver.findElement(By.css(".question-card button[type='submit']")).click();
      if (index < assessmentInitial.body.questions.length - 1) await driver.wait(async () => {
        const report = await driver.findElements(By.css(".assessment-question-feedback"));
        if (report.length) return true;
        const label = await driver.findElement(By.css(".assessment-progress .eyebrow")).getText().catch(() => "");
        return label !== priorLabel;
      }, 15000);
    }
    await driver.wait(until.elementLocated(By.css(".assessment-question-feedback")), 20000);
    const assessmentCompleted = await driver.executeAsyncScript(async (id, done) => {
      const token = localStorage.getItem("recallloop_token");
      const response = await fetch(`/api/assessments/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      done({ status: response.status, body: await response.json() });
    }, assessmentId);
    assert.equal(assessmentCompleted.status, 200);
    assert.equal(assessmentCompleted.body.result.total, assessmentInitial.body.questions.length, "The report should persist question-level evidence");
    assert.ok(assessmentCompleted.body.questions.every((question) => question.submittedAt && question.questionData.explanation !== undefined), "The report should reveal explanations only for submitted answers");
    assert.ok(assessmentCompleted.body.questions.every((question) => question.evaluation || question.questionType === "mcq"), "Submitted free responses should include validated evaluator evidence");
    assert.equal(assessmentCompleted.body.result.recommendation.actionType, "remediation", "An evidence-backed weakness should offer focused remediation instead of a generic retest");
    assert.ok(await driver.findElement(By.css(".assessment-question-feedback .assessment-feedback-row")), "The report should show individual answers and feedback");
    const submittedAttempt = assessmentCompleted.body.questions[0];
    const evaluationCountBeforeDuplicate = await pool.query("SELECT count(*)::int AS count FROM recall_evaluations WHERE recall_attempt_id=$1", [submittedAttempt.id]);
    const duplicateSubmission = await driver.executeAsyncScript(async (attemptId, optionId, done) => {
      const token = localStorage.getItem("recallloop_token");
      const response = await fetch(`/api/recalls/${attemptId}/submit`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ selectedOptionId: optionId, answer: "duplicate submission must not replace saved evidence", confidence: 10 }) });
      done({ status: response.status, body: await response.json() });
    }, submittedAttempt.id, submittedAttempt.selectedOptionId);
    assert.equal(duplicateSubmission.status, 409, "A completed canonical attempt must reject duplicate submission");
    const evaluationCountAfterDuplicate = await pool.query("SELECT count(*)::int AS count FROM recall_evaluations WHERE recall_attempt_id=$1", [submittedAttempt.id]);
    assert.equal(evaluationCountAfterDuplicate.rows[0].count, evaluationCountBeforeDuplicate.rows[0].count, "A duplicate response must not replace or append learner evidence");
    foreignAccountEmail = `u2-foreign-${Date.now()}@test.invalid`;
    const foreignAccountResponse = await fetch(`${apiUrl}/api/auth/register`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "U2 foreign owner", email: foreignAccountEmail, password: `U2-${Math.random().toString(36).slice(2)}-Password` }) });
    assert.equal(foreignAccountResponse.status, 201, "The isolated ownership check should create a disposable second learner");
    const foreignAccount = await foreignAccountResponse.json();
    const foreignRead = await fetch(`${apiUrl}/api/assessments/${assessmentId}`, { headers: { Authorization: `Bearer ${foreignAccount.token}` } });
    assert.equal(foreignRead.status, 404, "A different authenticated learner must not read this assessment report");
    const nextActionButton = await driver.findElement(By.css(".next-step-card button"));
    assert.match(await nextActionButton.getText(), /focused review/i, "An evidence-backed weakness should offer a relevant focused review");
    await nextActionButton.click();
    await driver.wait(until.urlMatches(/\/assessments\/[0-9a-f-]+\?returnTo=/i), 10000);
    const recommendedReviewId = new URL(await driver.getCurrentUrl()).pathname.split("/").at(-1);
    const recommendedReview = await learnerApi("GET", `/api/assessments/${recommendedReviewId}`);
    assert.equal(recommendedReview.status, 200);
    assert.equal(recommendedReview.body.assessment.mode, "deep_recall", "Focused review should use the existing deep-recall assessment path");
    assert.equal(recommendedReview.body.assessment.conceptId, assessmentInitial.body.assessment.conceptId, "The focused review must preserve the diagnosed learner concept");
    canonicalAssessmentState = { assessmentId, ...assessmentCompleted.body };
    console.log("PASS canonical knowledge-check journey: approved topic through persisted assessment report");
    await driver.get(`${clientUrl}/assessments/${assessmentId}?returnTo=%2Fknowledge-check`);
  }
  else console.log("LIMITATION knowledge-check completion: this database has no fully approved canonical assessment blueprint; the insufficient-coverage gate was tested instead");

  const domainJourneys = new Map();
  for (const candidate of allCatalogConcepts) {
    if (candidate.concept.supportedModes.includes("rapid_fire") && !domainJourneys.has(candidate.subject.domainName)) {
      domainJourneys.set(candidate.subject.domainName, candidate);
    }
  }
  const expectedDomains = ["Computer Networks", "Database Management Systems", "Data Structures and Algorithms", "Operating Systems", "System Design"];
  for (const domainName of expectedDomains) {
    const candidate = domainJourneys.get(domainName);
    assert.ok(candidate, `${domainName} should have at least one current, eligible Rapid Fire concept in the configured database`);
    await driver.get(`${clientUrl}/knowledge-check`);
    await driver.wait(until.elementLocated(By.id("knowledge-subject")), 10000);
    await chooseSelectValue(driver, "knowledge-subject", candidate.subject.id);
    await chooseSelectValue(driver, "knowledge-topic", candidate.topic.id);
    const choices = await driver.findElements(By.css("input[name='concept']"));
    let selectedConcept = false;
    for (const choice of choices) {
      if ((await choice.findElement(By.xpath("ancestor::label")).getText()).includes(candidate.concept.name)) {
        await choice.click();
        selectedConcept = true;
        break;
      }
    }
    assert.equal(selectedConcept, true, `${candidate.concept.name} should be available under ${domainName}`);
    await driver.wait(until.elementLocated(By.css("input[name='assessment-mode']")), 5000);
    await driver.findElement(By.css("input[name='assessment-mode']")).click();
    await driver.findElement(By.xpath("//button[contains(.,'Start knowledge check')]")).click();
    await driver.wait(until.urlMatches(/\/assessments\/[0-9a-f-]+/i), 10000);
    const domainAssessmentId = new URL(await driver.getCurrentUrl()).pathname.split("/").at(-1);
    const domainAssessment = await learnerApi("GET", `/api/assessments/${domainAssessmentId}`);
    assert.equal(domainAssessment.status, 200);
    assert.equal(domainAssessment.body.assessment.mode, "rapid_fire");
    const mappedAssessmentConcept = await pool.query(
      "SELECT canonical_concept_id FROM personal_concepts WHERE id=$1 AND user_id=(SELECT id FROM app_users WHERE email=$2)",
      [domainAssessment.body.assessment.conceptId, email],
    );
    assert.equal(mappedAssessmentConcept.rows[0]?.canonical_concept_id, candidate.concept.id, `${domainName} assessment should retain its canonical concept mapping`);
    assert.equal(domainAssessment.body.questions.length, 5);
    const domainRevisionIds = domainAssessment.body.questions.map((question) => question.canonicalQuestionRevisionId);
    assert.ok(domainRevisionIds.every(Boolean), `${domainName} assessment should pin every question to an immutable canonical revision`);
    const eligibleRevisionCount = await pool.query(
      `SELECT count(*)::int AS count FROM canonical_question_items i
       JOIN canonical_question_revisions r ON r.question_item_id=i.id AND r.revision=i.current_revision
       WHERE r.id=ANY($1::uuid[]) AND r.publication_status='published' AND r.quality_status='valid'
         AND r.review_status IN ('automated_reviewed','subject_matter_reviewed')`,
      [domainRevisionIds],
    );
    assert.equal(eligibleRevisionCount.rows[0].count, domainRevisionIds.length, `${domainName} assessment must use only eligible current revisions`);
    const domainSlug = domainName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    await driver.wait(until.elementLocated(By.xpath("//button[contains(.,'Start Rapid Fire')]")), 10000);
    await writeFile(path.join(screenshotDirectory, `domain-${domainSlug}-intro.png`), Buffer.from(await driver.takeScreenshot(), "base64"));
    await driver.findElement(By.xpath("//button[contains(.,'Start Rapid Fire')]")).click();
    for (let index = 0; index < domainAssessment.body.questions.length; index += 1) {
      await driver.wait(until.elementLocated(By.css(".question-card")), 10000);
      const progress = await driver.findElement(By.css(".assessment-progress .eyebrow")).getText();
      const options = await driver.findElements(By.css(".question-card input[type='radio']"));
      if (options.length) await options[0].click();
      else {
        const answerField = await driver.findElement(By.id("assessment-answer"));
        await answerField.sendKeys(`For ${candidate.concept.name}, I would explain the underlying mechanism, the conditions that matter, and its practical trade-off.`);
      }
      if (index === 0) await writeFile(path.join(screenshotDirectory, `domain-${domainSlug}-question.png`), Buffer.from(await driver.takeScreenshot(), "base64"));
      await driver.findElement(By.css(".question-card button[type='submit']")).click();
      if (index < domainAssessment.body.questions.length - 1) {
        await driver.wait(async () => (await driver.findElement(By.css(".assessment-progress .eyebrow")).getText()) !== progress, 15000);
      }
    }
    await driver.wait(until.elementLocated(By.css(".assessment-question-feedback")), 20000);
    const completedDomainAssessment = await learnerApi("GET", `/api/assessments/${domainAssessmentId}`);
    assert.equal(completedDomainAssessment.status, 200);
    assert.equal(completedDomainAssessment.body.result.total, 5);
    assert.ok(completedDomainAssessment.body.questions.every((question) => question.submittedAt), `${domainName} browser journey should submit every Rapid Fire answer`);
    const domainEvidenceCount = await pool.query(
      "SELECT count(*)::int AS count FROM recall_evaluations WHERE recall_attempt_id=ANY($1::uuid[])",
      [completedDomainAssessment.body.questions.map((question) => question.id)],
    );
    assert.equal(domainEvidenceCount.rows[0].count, 5, `${domainName} journey should persist evidence for all submitted answers`);
    await writeFile(path.join(screenshotDirectory, `domain-${domainSlug}-report.png`), Buffer.from(await driver.takeScreenshot(), "base64"));
    console.log(`PASS browser assessment journey: ${domainName} / ${candidate.concept.name} — 5 submitted answers, exact eligible revisions, persisted evidence`);
  }

  // Pilot every DBMS topic cluster that is now assessment-eligible, plus the
  // two previously covered OS concepts. This uses the same topic-selection and
  // assessment UI as the regular learner journey and pins each current revision.
  const pilotConcepts = [
    "Data partitioning", "Read replication", "Join and aggregation queries", "Relational data modeling", "Index selection", "Isolation and atomicity",
    "Processes, threads, and scheduling", "Synchronization and deadlocks",
  ];
  for (const conceptName of pilotConcepts) {
    const candidate = allCatalogConcepts.find(({ concept }) => concept.name === conceptName && concept.supportedModes.includes("rapid_fire"));
    assert.ok(candidate, `${conceptName} should have an eligible Rapid Fire assessment in the configured database`);
    await driver.get(`${clientUrl}/knowledge-check`);
    await driver.wait(until.elementLocated(By.id("knowledge-subject")), 10000);
    await chooseSelectValue(driver, "knowledge-subject", candidate.subject.id);
    await chooseSelectValue(driver, "knowledge-topic", candidate.topic.id);
    const choices = await driver.findElements(By.css("input[name='concept']"));
    let selected = false;
    for (const choice of choices) {
      if ((await choice.findElement(By.xpath("ancestor::label")).getText()).includes(conceptName)) {
        await choice.click(); selected = true; break;
      }
    }
    assert.equal(selected, true, `${conceptName} should be selectable from its current topic`);
    await driver.wait(until.elementLocated(By.css("input[name='assessment-mode']")), 5000);
    await driver.findElement(By.css("input[name='assessment-mode']")).click();
    await driver.findElement(By.xpath("//button[contains(.,'Start knowledge check')]")).click();
    await driver.wait(until.urlMatches(/\/assessments\/[0-9a-f-]+/i), 10000);
    const assessmentId = new URL(await driver.getCurrentUrl()).pathname.split("/").at(-1);
    const initial = await learnerApi("GET", `/api/assessments/${assessmentId}`);
    assert.equal(initial.status, 200);
    assert.equal(initial.body.assessment.mode, "rapid_fire");
    assert.equal(initial.body.questions.length, 5);
    assert.ok(initial.body.questions.every((question) => question.canonicalQuestionRevisionId), `${conceptName} must pin immutable canonical revisions`);
    assert.ok(initial.body.questions.every((question) => !("expectedAnswer" in question) && !("correctOptionId" in question) && !("answer" in question.questionData) && !("explanation" in question.questionData)), `${conceptName} answers and grading explanations must remain hidden before submission`);
    const currentIds = initial.body.questions.map((question) => question.canonicalQuestionRevisionId);
    const exactEligible = await pool.query(
      `SELECT count(*)::int AS count FROM canonical_question_items i JOIN canonical_question_revisions r ON r.question_item_id=i.id AND r.revision=i.current_revision
       WHERE r.id=ANY($1::uuid[]) AND i.canonical_concept_id=$2 AND r.publication_status='published' AND r.quality_status='valid' AND r.review_status IN ('automated_reviewed','subject_matter_reviewed')`,
      [currentIds, candidate.concept.id],
    );
    assert.equal(exactEligible.rows[0].count, 5, `${conceptName} must use only its eligible exact current revisions`);
    await driver.findElement(By.xpath("//button[contains(.,'Start Rapid Fire')]")).click();
    for (let index = 0; index < initial.body.questions.length; index += 1) {
      await driver.wait(until.elementLocated(By.css(".question-card")), 10000);
      const progress = await driver.findElement(By.css(".assessment-progress .eyebrow")).getText();
      const options = await driver.findElements(By.css(".question-card input[type='radio']"));
      if (options.length) await options[index === 0 && conceptName === "Join and aggregation queries" ? 1 : 0].click();
      else await driver.findElement(By.id("assessment-answer")).sendKeys(`For ${conceptName}, I would state the applicable rule, apply its conditions, and explain the resulting behavior or trade-off.`);
      await driver.findElement(By.css(".question-card button[type='submit']")).click();
      if (index < initial.body.questions.length - 1) await driver.wait(async () => (await driver.findElement(By.css(".assessment-progress .eyebrow")).getText()) !== progress, 15000);
    }
    await driver.wait(until.elementLocated(By.css(".assessment-question-feedback")), 20000);
    const completed = await learnerApi("GET", `/api/assessments/${assessmentId}`);
    assert.equal(completed.status, 200);
    assert.equal(completed.body.result.total, 5);
    assert.ok(completed.body.questions.every((question) => question.submittedAt), `${conceptName} answers must be submitted`);
    const evidence = await pool.query("SELECT count(*)::int AS count FROM recall_evaluations WHERE recall_attempt_id=ANY($1::uuid[])", [completed.body.questions.map((question) => question.id)]);
    assert.equal(evidence.rows[0].count, 5, `${conceptName} must persist evidence for every answer`);
    await driver.get(`${clientUrl}/assessments/${assessmentId}`);
    const reloaded = await learnerApi("GET", `/api/assessments/${assessmentId}`);
    assert.equal(reloaded.status, 200, `${conceptName} result should survive reload`);
    assert.ok(reloaded.body.questions.every((question) => question.submittedAt), `${conceptName} submitted state should persist after reload`);
    if (conceptName === "Join and aggregation queries") canonicalDbmsAssessmentState = { assessmentId, canonicalConceptId: candidate.concept.id, ...completed.body };
    console.log(`PASS DBMS/OS learner pilot: ${conceptName} — 5 exact eligible revisions, submitted and persisted`);
  }

  // Journey B: a learner can study supplied text directly from Home without first taking a test.
  await driver.get(`${clientUrl}/dashboard`);
  const homeLearnLink = await driver.wait(until.elementLocated(By.css("a[href='/study/new']")), 10000);
  await homeLearnLink.click();
  await driver.wait(until.elementLocated(By.id("study-topic")), 10000);
  await driver.findElement(By.id("study-topic")).sendKeys("E2E learning intent topic");
  await driver.findElement(By.css("input[name='learningIntent'][value='remember']")).click();
  await driver.findElement(By.id("material")).sendKeys("A cache reuses a response while it is fresh. Validation asks the origin whether a stale response has changed.");
  await driver.findElement(By.css("form.study-form button[type='submit']")).click();
  await driver.wait(until.urlMatches(/\/study\/[0-9a-f-]+\?intent=remember/i), 15000);
  const guidedStudyId = new URL(await driver.getCurrentUrl()).pathname.split("/").at(-1);
  const guidedStudy = await driver.executeAsyncScript(async (id, done) => {
    const token = localStorage.getItem("recallloop_token");
    const response = await fetch(`/api/study-sessions/${id}`, { headers: { Authorization: `Bearer ${token}` } });
    done({ status: response.status, body: await response.json() });
  }, guidedStudyId);
  assert.equal(guidedStudy.status, 200, "The guided learn flow should create a persisted session");
  assert.ok(guidedStudy.body.concepts.length > 0, "The provided study text should produce persisted concepts for follow-up");
  await driver.wait(until.elementLocated(By.css(".hero")), 10000);
  assert.match(await driver.findElement(By.css(".hero")).getText(), /strengthen your recall/i);
  await driver.findElement(By.xpath("//button[contains(.,'Start recall practice')]")).click();
  await driver.wait(until.urlMatches(/\/recall\/[0-9a-f-]+$/i), 10000);
  const guidedRecallId = new URL(await driver.getCurrentUrl()).pathname.split("/").at(-1);
  const guidedRecall = await driver.executeAsyncScript(async (id, done) => {
    const token = localStorage.getItem("recallloop_token");
    const response = await fetch(`/api/recalls/${id}`, { headers: { Authorization: `Bearer ${token}` } });
    done({ status: response.status, body: await response.json() });
  }, guidedRecallId);
  assert.equal(guidedRecall.status, 200);
  assert.equal(guidedRecall.body.recall.studySessionId, guidedStudyId, "The learn-to-recall handoff should use an attempt from its persisted study session");

  await driver.get(`${clientUrl}/onboarding`);
  await driver.wait(until.elementLocated(By.id("start-topic")), 10000);
  const starterSelect = await driver.findElement(By.id("start-topic"));
  const starterOptions = await starterSelect.findElements(By.css("option"));
  assert.ok(starterOptions.length > 1, "Onboarding should offer a real catalog focus area");
  await starterSelect.findElement(By.css("option:not([value=''])")).click();
  await driver.findElement(By.css("form.onboarding-form button[type='submit']")).click();
  await driver.wait(until.urlContains("/study/new?topic="), 10000);
  const studyNextSteps = await driver.wait(until.elementLocated(By.css(".study-next-steps")), 10000);
  await driver.wait(async () => /Review concepts[\s\S]*Recall/.test(await studyNextSteps.getText()), 10000);
  assert.match(await studyNextSteps.getText(), /Review concepts[\s\S]*Recall/);
  await driver.findElement(By.id("material")).sendKeys("A cache reuses a response while it is fresh. Validation asks the origin whether a stale response has changed.");
  await driver.findElement(By.css("form.study-form button[type='submit']")).click();
  await driver.wait(until.urlMatches(/\/study\/[0-9a-f-]+(?:\?.*)?$/i), 15000);
  const firstJourneySessionId = new URL(await driver.getCurrentUrl()).pathname.split("/").at(-1);
  const firstJourneySession = await fetch(`${apiUrl}/api/study-sessions/${firstJourneySessionId}`, {
    headers: { Authorization: `Bearer ${await driver.executeScript("return localStorage.getItem('recallloop_token')")}` },
  });
  assert.equal(firstJourneySession.status, 200, "A new learner should reach a persisted study session through onboarding and the study form");

  await driver.wait(until.elementLocated(By.css("a[href='/knowledge']")), 10000);
  await driver.findElement(By.css("a[href='/knowledge']")).click();
  await driver.wait(until.elementLocated(By.xpath("//h1[normalize-space()='Knowledge map']")), 10000);
  await driver.wait(until.elementLocated(By.xpath("//h2[normalize-space()='Backend Engineer']")), 10000);
  await driver.findElement(By.xpath("//h2[normalize-space()='Backend Engineer']/ancestor::a")).click();
  await driver.wait(until.elementLocated(By.xpath("//h1[normalize-space()='Backend Engineer']")), 10000);

  const topicElement = await driver.findElement(By.xpath("//h3[normalize-space()='Caching']/ancestor::section[contains(@class,'card')]"));
  const cacheAside = await topicElement.findElement(By.xpath(".//h4[normalize-space()='Cache-aside pattern']/ancestor::article[contains(@class,'card')]"));
  const summary = await cacheAside.findElement(By.css("summary"));
  const pointSummary = await summary.getText();
  assert.match(pointSummary, /^1 knowledge points$/i, "Cache-aside should render one distinct knowledge point");
  await summary.click();
  const pointText = await cacheAside.findElement(By.xpath(".//li[contains(.,'Can explain cache hit, miss, load, and populate steps.')]")).getText();
  assert.match(pointText, /Can explain cache hit, miss, load, and populate steps\./);

  const apiRole = await driver.executeAsyncScript(async (done) => {
    const token = localStorage.getItem("recallloop_token");
    const rolesResponse = await fetch("/api/knowledge/roles");
    const rolesBody = await rolesResponse.json();
    const role = rolesBody.roles.find((item) => item.name === "Backend Engineer");
    if (!role) return done({ error: "Backend Engineer missing from role list" });
    const response = await fetch(`/api/knowledge/roles/${role.id}/roadmap`, { headers: { Authorization: `Bearer ${token}` } });
    done(await response.json());
  });
  assert.ok(apiRole.role, `Authenticated roadmap API failed: ${JSON.stringify(apiRole)}`);
  const caching = apiRole.role.skills.flatMap((skill) => skill.topics).find((topic) => topic.name === "Caching");
  const cacheConcept = caching?.concepts.find((item) => item.name === "Cache-aside pattern");
  assert.deepEqual(cacheConcept?.knowledgePoints.map((point) => point.statement), ["Can explain cache hit, miss, load, and populate steps."]);
  const httpSelection = allCatalogConcepts.find(({ subject, concept }) => subject.domainName === "Computer Networks" && concept.name === "HTTP caching");
  assert.ok(httpSelection, "The canonical HTTP caching concept should remain present in current topic coverage");
  const httpTopic = httpSelection.topic;
  const concept = httpSelection.concept;
  assert.deepEqual(concept?.knowledgePoints.map((point) => point.statement), ["Can distinguish freshness from validation."], "HTTP assessment coverage should use its current canonical Computer Networks mapping");

  const persistedCountBeforeRejectedInputs = await pool.query(
    "SELECT count(*)::int AS count FROM study_sessions WHERE user_id=(SELECT id FROM app_users WHERE email=$1)",
    [email],
  );
  await driver.get(`${clientUrl}/study/new`);
  const topicInput = await driver.findElement(By.id("study-topic"));
  const materialInput = await driver.findElement(By.id("material"));
  await topicInput.sendKeys("https://example.com/cache");
  await materialInput.sendKeys("Cache freshness depends on the response freshness lifetime.");
  await driver.findElement(By.css("button[type='submit']")).click();
  let alert = await driver.wait(until.elementLocated(By.css("[role='alert']")), 5000);
  assert.match(await alert.getText(), /Enter a topic name here/);
  assert.equal(await driver.executeScript("return arguments[0].value", topicInput), "https://example.com/cache", "Rejected topic input should remain available for correction");

  await topicInput.clear();
  await topicInput.sendKeys("Cache freshness");
  await materialInput.clear();
  await materialInput.sendKeys("https://example.com/cache");
  await driver.findElement(By.css("button[type='submit']")).click();
  alert = await driver.wait(until.elementLocated(By.css("[role='alert']")), 5000);
  assert.match(await alert.getText(), /Add notes or source text/);

  const persistedSessions = await pool.query(
    "SELECT count(*)::int AS count FROM study_sessions WHERE user_id=(SELECT id FROM app_users WHERE email=$1)",
    [email],
  );
  assert.equal(persistedSessions.rows[0].count, persistedCountBeforeRejectedInputs.rows[0].count, "Rejected study inputs must not leave orphan sessions");

  async function learnerApi(method, route, body) {
    const response = await fetch(`${apiUrl}${route}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, body: await response.json() };
  }

  if (canonicalAssessmentState) {
    const weakAttempt = canonicalAssessmentState.questions.find((question) => question.evaluation?.knowledgePointResults?.some((point) => point.status === "missing" || point.status === "partial"));
    assert.ok(weakAttempt, "The deliberately incorrect answer should create an evidence-backed weak point");
    const httpSourceReference = "https://example.com/u2-http-cache-notes";
    const httpSource = await learnerApi("POST", "/api/grounding/sources", {
      title: "U2 HTTP cache notes",
      text: "HTTP caches may reuse a response while it remains fresh without contacting the origin. A stale response can be validated with If-None-Match using an ETag or If-Modified-Since. A 304 Not Modified response lets the cache reuse its stored response body while updating metadata.",
      sourceType: "markdown", reference: httpSourceReference, provenance: { providedBy: "learner", test: "isolated-u2" },
    });
    assert.equal(httpSource.status, 201, `Could not ingest isolated HTTP remediation notes: ${JSON.stringify(httpSource.body)}`);
    const remediationResult = await learnerApi("POST", `/api/remediations/from-attempt/${weakAttempt.id}`);
    assert.equal(remediationResult.status, 200, `Could not create HTTP point remediation: ${JSON.stringify(remediationResult.body)}`);
    const httpRemediation = remediationResult.body.remediation;
    assert.equal(httpRemediation.status, "ready");
    assert.equal(httpRemediation.knowledgePoint, "Can distinguish freshness from validation.");
    assert.ok(httpRemediation.sources.some((source) => source.sourceId === httpSource.body.source.id && source.reference === httpSourceReference), "Targeted remediation must cite the learner-provided source relevant to the assessed point");
    await driver.get(`${clientUrl}/remediations/${httpRemediation.id}`);
    await driver.wait(until.elementLocated(By.css(".remediation-explanation")), 10000);
    await writeFile(path.join(screenshotDirectory, "targeted-remediation.png"), Buffer.from(await driver.takeScreenshot(), "base64"));
    await driver.findElement(By.xpath("//button[contains(.,'Check what you remember')]")).click();
    await driver.wait(until.urlMatches(/\/recall\/[0-9a-f-]+$/i), 10000);
    const verificationAttemptId = new URL(await driver.getCurrentUrl()).pathname.split("/").at(-1);
    const targetedQuestion = await learnerApi("GET", `/api/recalls/${verificationAttemptId}`);
    assert.equal(targetedQuestion.status, 200);
    assert.ok(!canonicalAssessmentState.questions.some((question) => question.questionData.prompt === targetedQuestion.body.recall.questionData.prompt), "Verification should ask different wording from the assessment prompts");
    assert.ok(targetedQuestion.body.recall.canonicalQuestionRevisionId, "An unseen approved canonical question should be used when the review gate makes one available");
    assert.ok(!canonicalAssessmentState.questions.some((question) => question.canonicalQuestionRevisionId === targetedQuestion.body.recall.canonicalQuestionRevisionId), "Verification must use a different immutable revision from the completed Rapid Fire round");
    await driver.wait(until.elementLocated(By.id("answer")), 10000);
    await writeFile(path.join(screenshotDirectory, "verification-question.png"), Buffer.from(await driver.takeScreenshot(), "base64"));
    await driver.findElement(By.id("answer")).sendKeys("I can distinguish freshness from validation. A fresh response can be reused without contacting the origin. A stale response is validated with an ETag or Last-Modified validator; a 304 response lets the cache reuse the stored body.");
    await driver.findElement(By.css("form button[type='submit']")).click();
    await driver.wait(until.urlContains(`/recall/${verificationAttemptId}/result`), 10000);
    const verifiedHttpRemediation = await learnerApi("GET", `/api/remediations/${httpRemediation.id}`);
    assert.equal(verifiedHttpRemediation.body.remediation.status, "verified");
    assert.equal(verifiedHttpRemediation.body.remediation.improved, true, "The verification attempt should update the persisted remediation outcome");
    const persistedVerification = await pool.query(`SELECT kp.canonical_knowledge_point_id,a.canonical_question_revision_id FROM recall_attempts a JOIN recall_evaluations e ON e.recall_attempt_id=a.id JOIN recall_knowledge_point_results kp ON kp.evaluation_id=e.id WHERE a.id=$1`, [verificationAttemptId]);
    assert.equal(persistedVerification.rows[0]?.canonical_knowledge_point_id, concept.knowledgePoints[0].id, "Verification evidence must retain the diagnosed canonical point mapping");
    assert.equal(persistedVerification.rows[0]?.canonical_question_revision_id, targetedQuestion.body.recall.canonicalQuestionRevisionId, "The verification attempt must retain its exact approved revision link");
    const readinessGoal = await learnerApi("POST", "/api/goals", { title: "U2 HTTP verification readiness", description: "Disposable end-to-end evidence check", goalType: "learning", weeklyTimeBudgetMinutes: 60 });
    assert.equal(readinessGoal.status, 201);
    const canonicalSkill = await pool.query("SELECT cs.name FROM canonical_concepts cc JOIN topics t ON t.id=cc.topic_id JOIN canonical_skills cs ON cs.id=t.skill_id WHERE cc.id=$1", [concept.id]);
    const readinessSkill = await learnerApi("POST", `/api/goals/${readinessGoal.body.goal.id}/skills`, { name: canonicalSkill.rows[0].name, description: "HTTP verification evidence", priority: 80 });
    assert.equal(readinessSkill.status, 201);
    const verifiedReadiness = await learnerApi("GET", `/api/goals/${readinessGoal.body.goal.id}/readiness`);
    const httpReadiness = verifiedReadiness.body.skills.find((skill) => skill.name === canonicalSkill.rows[0].name);
    assert.equal(httpReadiness.strengths, 1, "My Readiness should reflect the latest submitted verification evidence for the mapped point");
    console.log("PASS canonical assessment-to-remediation-to-verification-to-readiness loop in disposable PostgreSQL");
  }

  if (canonicalDbmsAssessmentState) {
    const weakAttempt = canonicalDbmsAssessmentState.questions.find((question) => question.evaluation?.knowledgePointResults?.some((point) => point.status === "missing" || point.status === "partial"));
    assert.ok(weakAttempt, "The deliberately incorrect DBMS answer should create evidence for a specific weak point");
    const dbmsSourceReference = "https://example.com/u2-dbms-join-notes";
    const dbmsSource = await learnerApi("POST", "/api/grounding/sources", {
      title: "U2 DBMS join and aggregation notes",
      text: "An INNER JOIN returns matching row pairs. A LEFT JOIN keeps each left-side row and supplies NULL for missing right-side values. A one-to-many join can multiply rows. WHERE filters rows before grouping; HAVING filters groups after aggregate values are computed. Preserve the intended grain or pre-aggregate before joining another one-to-many relation.",
      sourceType: "markdown", reference: dbmsSourceReference, provenance: { providedBy: "learner", test: "dbms-pilot" },
    });
    assert.equal(dbmsSource.status, 201, `Could not ingest DBMS remediation notes: ${JSON.stringify(dbmsSource.body)}`);
    const remediationResult = await learnerApi("POST", `/api/remediations/from-attempt/${weakAttempt.id}`);
    assert.equal(remediationResult.status, 200, `Could not create DBMS remediation: ${JSON.stringify(remediationResult.body)}`);
    const remediation = remediationResult.body.remediation;
    assert.equal(remediation.status, "ready");
    assert.ok(["Can predict INNER and LEFT JOIN row preservation, NULL extension, and row multiplication from join cardinality.", "Can write or diagnose grouped aggregates using WHERE, HAVING, join grain, and duplicate-count safeguards."].includes(remediation.knowledgePoint), "DBMS remediation must target the diagnosed join or aggregation point");
    assert.ok(remediation.sources.some((source) => source.sourceId === dbmsSource.body.source.id && source.reference === dbmsSourceReference), "DBMS remediation must cite the learner-provided source that covers the diagnosed skill");
    await driver.get(`${clientUrl}/remediations/${remediation.id}`);
    await driver.wait(until.elementLocated(By.css(".remediation-explanation")), 10000);
    await driver.findElement(By.xpath("//button[contains(.,'Check what you remember')]" )).click();
    await driver.wait(until.urlMatches(/\/recall\/[0-9a-f-]+$/i), 10000);
    const verificationId = new URL(await driver.getCurrentUrl()).pathname.split("/").at(-1);
    const verification = await learnerApi("GET", `/api/recalls/${verificationId}`);
    assert.equal(verification.status, 200);
    assert.ok(verification.body.recall.canonicalQuestionRevisionId, "DBMS verification should select a current approved canonical revision");
    assert.ok(!canonicalDbmsAssessmentState.questions.some((question) => question.canonicalQuestionRevisionId === verification.body.recall.canonicalQuestionRevisionId), "DBMS verification must use a distinct immutable revision");
    const answer = remediation.knowledgePoint.startsWith("Can predict INNER")
      ? "INNER JOIN returns only matching row pairs. LEFT JOIN preserves each left row and uses NULL for a missing right row; one-to-many matches multiply rows. A right-side WHERE filter can remove the NULL-extended rows."
      : "WHERE filters paid order rows before grouping by customer. HAVING filters groups with at least two paid orders. A second one-to-many join can multiply order rows and inflate counts and sums, so preserve order grain or pre-aggregate orders first.";
    await driver.findElement(By.id("answer")).sendKeys(answer);
    await driver.findElement(By.css("form button[type='submit']")).click();
    await driver.wait(until.urlContains(`/recall/${verificationId}/result`), 10000);
    const verifiedRemediation = await learnerApi("GET", `/api/remediations/${remediation.id}`);
    assert.equal(verifiedRemediation.body.remediation.status, "verified");
    assert.equal(verifiedRemediation.body.remediation.improved, true, "DBMS verification should persist improvement evidence");
    const persisted = await pool.query(`SELECT kp.canonical_knowledge_point_id,a.canonical_question_revision_id FROM recall_attempts a JOIN recall_evaluations e ON e.recall_attempt_id=a.id JOIN recall_knowledge_point_results kp ON kp.evaluation_id=e.id WHERE a.id=$1`, [verificationId]);
    assert.equal(persisted.rows[0]?.canonical_question_revision_id, verification.body.recall.canonicalQuestionRevisionId);
    const diagnosedPoint = await pool.query("SELECT id FROM knowledge_points WHERE concept_id=$1 AND statement=$2", [canonicalDbmsAssessmentState.canonicalConceptId, remediation.knowledgePoint]);
    assert.equal(persisted.rows[0]?.canonical_knowledge_point_id, diagnosedPoint.rows[0]?.id, "DBMS verification evidence must remain attached to the exact diagnosed canonical point");
    const goal = await learnerApi("POST", "/api/goals", { title: "U2 DBMS verification readiness", description: "Disposable DBMS evidence check", goalType: "learning", weeklyTimeBudgetMinutes: 60 });
    assert.equal(goal.status, 201);
    const skill = await pool.query("SELECT cs.name FROM canonical_concepts cc JOIN topics t ON t.id=cc.topic_id JOIN canonical_skills cs ON cs.id=t.skill_id WHERE cc.id=$1", [canonicalDbmsAssessmentState.canonicalConceptId]);
    const readinessSkillResult = await learnerApi("POST", `/api/goals/${goal.body.goal.id}/skills`, { name: skill.rows[0].name, description: "DBMS verification evidence", priority: 80 });
    assert.equal(readinessSkillResult.status, 201);
    const readiness = await learnerApi("GET", `/api/goals/${goal.body.goal.id}/readiness`);
    const dbmsReadiness = readiness.body.skills.find((item) => item.name === skill.rows[0].name);
    assert.equal(dbmsReadiness.totalPoints, 12);
    assert.equal(dbmsReadiness.unassessedPoints, dbmsReadiness.totalPoints - dbmsReadiness.assessedPoints);
    assert.ok(dbmsReadiness.unassessedPoints > 0, "Unassessed DBMS points must remain explicitly unknown after a partial learner pilot");
    assert.ok(dbmsReadiness.strengths >= 1, "Readiness should reflect the persisted successful DBMS verification");
    await driver.get(`${clientUrl}/assessments/${canonicalDbmsAssessmentState.assessmentId}`);
    const afterReload = await learnerApi("GET", `/api/assessments/${canonicalDbmsAssessmentState.assessmentId}`);
    assert.ok(afterReload.body.questions.every((question) => question.submittedAt), "DBMS learner evidence should survive a result reload");
    console.log("PASS DBMS diagnosis-to-grounded-remediation-to-distinct-verification loop with persisted improvement evidence");
  }

  assert.ok(caching && cacheConcept, "Backend Engineer should retain its actual Cache-aside topic mapping");
  await driver.get(`${clientUrl}/knowledge/roles/${apiRole.role.id}`);
  await driver.wait(until.elementLocated(By.id(`concept-${cacheConcept.id}`)), 10000);
  const canonicalArticle = await driver.findElement(By.id(`concept-${cacheConcept.id}`));
  const canonicalStudyLink = await canonicalArticle.findElement(By.xpath(".//a[normalize-space()='Study concept']"));
  await canonicalStudyLink.click();
  await driver.wait(until.urlContains("/study/new?"), 10000);
  const handoffUrl = new URL(await driver.getCurrentUrl());
  assert.equal(handoffUrl.searchParams.get("topicId"), caching.id);
  assert.equal(handoffUrl.searchParams.get("conceptId"), cacheConcept.id, "Roadmap study link should preserve the selected canonical concept ID");
  await driver.wait(until.elementLocated(By.id("study-topic")), 10000);
  const canonicalTitleInput = await driver.findElement(By.id("study-topic"));
  assert.equal(await canonicalTitleInput.getAttribute("value"), "Cache-aside pattern");
  await driver.get(`${clientUrl}/study/new?${new URLSearchParams({ topic: concept.name, topicId: httpTopic.id, conceptId: concept.id })}`);
  await driver.wait(until.elementLocated(By.id("study-topic")), 10000);
  assert.equal(await driver.findElement(By.id("study-topic")).getAttribute("value"), "HTTP caching");
  await driver.findElement(By.id("material")).sendKeys("# HTTP caching.\n\nCan distinguish freshness from validation.");
  await driver.findElement(By.css("button[type='submit']")).click();
  await driver.wait(until.urlMatches(/\/study\/[0-9a-f-]+\?/i), 15000);
  const canonicalSessionId = new URL(await driver.getCurrentUrl()).pathname.split("/").at(-1);
  const canonicalStudy = await learnerApi("GET", `/api/study-sessions/${canonicalSessionId}`);
  assert.equal(canonicalStudy.status, 200);
  assert.equal(canonicalStudy.body.session.canonicalTopicId, httpTopic.id);
  assert.equal(canonicalStudy.body.session.canonicalConceptId, concept.id);
  const mappedPersonalConcept = canonicalStudy.body.concepts.find((item) => item.name === "HTTP caching");
  assert.ok(mappedPersonalConcept, "The extracted concept should retain the canonical concept name");
  assert.equal(mappedPersonalConcept.canonicalConceptId, concept.id);
  assert.ok(mappedPersonalConcept.requiredKnowledgePoints.includes(concept.knowledgePoints[0].statement), "The exact canonical point statement should survive extraction");
  const canonicalPointCountBefore = await pool.query("SELECT count(*)::int AS count FROM knowledge_points WHERE concept_id=$1", [concept.id]);
  assert.equal(canonicalPointCountBefore.rows[0].count, 1);

  const learnerId = (await pool.query("SELECT id FROM app_users WHERE email=$1", [email])).rows[0].id;
  const canonicalPractice = await learnerApi("POST", "/api/assessments", { conceptId: mappedPersonalConcept.id, mode: "deep_recall" });
  assert.equal(canonicalPractice.status, 201, `The eligible HTTP deep-recall mode should create an assessment: ${JSON.stringify(canonicalPractice.body)}`);
  const canonicalPracticeDetails = await learnerApi("GET", `/api/assessments/${canonicalPractice.body.assessment.id}`);
  assert.equal(canonicalPracticeDetails.status, 200);
  assert.ok(canonicalPracticeDetails.body.questions.every((question) => question.canonicalQuestionRevisionId), "Canonical assessment snapshots must retain exact question revisions");
  const exactRevisions = await pool.query(
    `SELECT count(*)::int count FROM canonical_question_items i JOIN canonical_question_revisions r ON r.question_item_id=i.id AND r.revision=i.current_revision
     WHERE r.id = ANY($1::uuid[]) AND r.publication_status='published' AND r.review_status IN ('automated_reviewed','subject_matter_reviewed')`,
    [canonicalPracticeDetails.body.questions.map((question) => question.canonicalQuestionRevisionId)],
  );
  assert.equal(exactRevisions.rows[0].count, canonicalPracticeDetails.body.questions.length, "Assessment must use only eligible exact current revisions");
  const canonicalPointCountAfter = await pool.query("SELECT count(*)::int AS count FROM knowledge_points WHERE concept_id=$1", [concept.id]);
  assert.equal(canonicalPointCountAfter.rows[0].count, canonicalPointCountBefore.rows[0].count, "Studying and assessing the canonical concept must not create duplicate catalog points");
  await driver.get(`${clientUrl}/resources?conceptId=${mappedPersonalConcept.id}`);
  await driver.wait(until.elementLocated(By.xpath("//h1[normalize-space()='Focused resources']")), 10000);
  await driver.wait(until.elementLocated(By.css("article.resource-card")), 10000);
  const focusedResources = await learnerApi("GET", `/api/resources/recommendations?conceptId=${mappedPersonalConcept.id}&availableMinutes=60`);
  assert.equal(focusedResources.status, 200);
  assert.ok(focusedResources.body.resources.length > 0);
  const renderedResourceCards = await driver.findElements(By.css("article.resource-card"));
  assert.equal(renderedResourceCards.length, focusedResources.body.resources.length, "The resource screen should render the API's diagnosed-concept recommendations");
  for (const resource of focusedResources.body.resources) {
    assert.ok(resource.conceptsCovered.includes("HTTP caching"), "A recommended source must map to the diagnosed canonical concept");
    assert.ok(/^https?:\/\//i.test(resource.url));
    const card = await driver.findElement(By.xpath(`//article[contains(@class,'resource-card')][.//h2[normalize-space()=${JSON.stringify(resource.title)}]]`));
    assert.equal(await card.findElement(By.css(".resource-provider")).getText(), resource.provider);
    const sourceLink = await card.findElement(By.xpath(".//a[contains(.,'Open resource')]"));
    assert.equal(await sourceLink.getAttribute("href"), resource.url);
    assert.ok((await card.findElement(By.css(".resource-why")).getText()).includes("HTTP caching"));
  }
  const studyTitle = "E2E cache notes";
  const studySourceUrl = "https://example.com/cache-reference";
  const studyMaterial = "Freshness tells a cache how long a response may be reused. Validation asks the origin server whether a stale response has changed.";
  await driver.get(`${clientUrl}/study/new`);
  await driver.findElement(By.id("study-topic")).sendKeys(studyTitle);
  await driver.findElement(By.id("source-url")).sendKeys(studySourceUrl);
  await driver.findElement(By.id("material")).sendKeys(studyMaterial);
  await driver.findElement(By.css("button[type='submit']")).click();
  await driver.wait(until.urlMatches(/\/study\/[0-9a-f-]+(?:\?.*)?$/i), 15000);
  const createdSessionId = new URL(await driver.getCurrentUrl()).pathname.split("/").at(-1);
  const createdStudy = await learnerApi("GET", `/api/study-sessions/${createdSessionId}`);
  assert.equal(createdStudy.status, 200);
  assert.equal(createdStudy.body.session.title, studyTitle);
  assert.equal(createdStudy.body.session.sourceUrl, studySourceUrl, "The source URL should persist as separate provenance");
  assert.equal(createdStudy.body.session.rawMaterial, studyMaterial, "Only supplied notes should be the extraction material");
  assert.ok(createdStudy.body.concepts.length > 0, "Valid notes should persist extracted concepts");
  await driver.get(`${clientUrl}/resources?conceptId=${createdStudy.body.concepts[0].id}`);
  await driver.wait(until.elementLocated(By.xpath("//h1[normalize-space()='Focused resources']")), 10000);
  await driver.wait(until.elementLocated(By.xpath("//*[normalize-space()='No matching resources yet']")), 10000);
  const noMatch = await learnerApi("GET", `/api/resources/recommendations?conceptId=${createdStudy.body.concepts[0].id}&availableMinutes=60`);
  assert.deepEqual(noMatch.body.resources, [], "A custom concept without catalog coverage should return an empty recommendation list");
  await driver.get(`${clientUrl}/study/${createdSessionId}`);
  const extractedText = createdStudy.body.concepts.flatMap((item) => [item.name, item.description, ...item.requiredKnowledgePoints]).join(" ");
  assert.doesNotMatch(extractedText, /https?:\/\/|www\.|example\.com/i, "URLs must not leak into extracted concept data");
  await driver.wait(until.elementLocated(By.xpath(`//h1[normalize-space()='${studyTitle}']`)), 10000);
  await pool.query("UPDATE study_sessions SET title=$1 WHERE id=$2 AND user_id=$3", ["https://www.youtube.com/watch?v=legacy-title", createdSessionId, learnerId]);
  await driver.get(`${clientUrl}/study/${createdSessionId}`);
  await driver.wait(until.elementLocated(By.xpath("//h1[normalize-space()='Review recent study session']")), 10000);
  assert.equal(await driver.findElement(By.xpath("//a[normalize-space()='Open saved source link']")).getAttribute("href"), studySourceUrl, "Hiding a historical URL title should preserve its separately stored source link");
  await driver.findElement(By.xpath("//summary[contains(.,'Choose a practice mode')]")).click();
  await driver.findElement(By.xpath("//button[normalize-space()='Start Rapid Fire']")).click();
  await driver.wait(until.urlMatches(/\/assessments\/[0-9a-f-]+$/i), 15000);
  const assessmentId = (await driver.getCurrentUrl()).split("/assessments/")[1];
  const generatedAssessment = await learnerApi("GET", `/api/assessments/${assessmentId}`);
  assert.equal(generatedAssessment.status, 200);
  const generatedQuestionText = generatedAssessment.body.questions.map((item) => item.questionData?.prompt ?? item.question).join(" ");
  assert.doesNotMatch(generatedQuestionText, /https?:\/\/|www\.|example\.com/i, "Generated question prompts must not contain source URL data");
  const storedStudy = await pool.query(
    `SELECT ss.source_url,ss.raw_material,c.name,c.description,c.required_knowledge_points
     FROM study_sessions ss JOIN personal_concepts c ON c.study_session_id=ss.id
     WHERE ss.id=$1 AND ss.user_id=(SELECT id FROM app_users WHERE email=$2)`,
    [createdSessionId, email],
  );
  assert.ok(storedStudy.rows.length > 0, "The source, concepts, and knowledge points should exist in PostgreSQL");
  assert.ok(storedStudy.rows.every((row) => row.source_url === studySourceUrl && row.raw_material === studyMaterial));

  const goalResponse = await learnerApi("POST", "/api/goals", {
    title: "E2E baseline recovery",
    description: "Disposable browser test goal",
    goalType: "learning",
    weeklyTimeBudgetMinutes: 120,
  });
  assert.equal(goalResponse.status, 201, `Could not create E2E goal: ${JSON.stringify(goalResponse.body)}`);
  const dailyPlanGoalId = goalResponse.body.goal.id;
  const skillResponse = await learnerApi("POST", `/api/goals/${dailyPlanGoalId}/skills`, { name: "HTTP caching", description: "Evidence-backed E2E focus", priority: 90 });
  assert.equal(skillResponse.status, 201);
  const canonicalSkillForReadiness = await pool.query("SELECT cs.name FROM canonical_concepts cc JOIN topics t ON t.id=cc.topic_id JOIN canonical_skills cs ON cs.id=t.skill_id WHERE cc.id=$1", [concept.id]);
  assert.ok(canonicalSkillForReadiness.rows[0]?.name);
  const mappedSkillResponse = await learnerApi("POST", `/api/goals/${dailyPlanGoalId}/skills`, { name: canonicalSkillForReadiness.rows[0].name, description: "Canonical readiness focus", priority: 80 });
  assert.equal(mappedSkillResponse.status, 201);
  const customSkillResponse = await learnerApi("POST", `/api/goals/${dailyPlanGoalId}/skills`, { name: "Uncatalogued systems topic", description: "No canonical mapping", priority: 35 });
  assert.equal(customSkillResponse.status, 201);
  const readiness = await learnerApi("GET", `/api/goals/${dailyPlanGoalId}/readiness`);
  assert.equal(readiness.status, 200);
  const mappedReadiness = readiness.body.skills.find((skill) => skill.name === canonicalSkillForReadiness.rows[0].name);
  assert.equal(mappedReadiness.status, "mapped");
  assert.ok(mappedReadiness.assessedPoints > 0, "The completed canonical assessment should appear in persisted readiness evidence");
  assert.ok(mappedReadiness.totalPoints > 0, "The selected canonical skill should retain its mapped point scope");
  const unmappedReadiness = readiness.body.skills.find((skill) => skill.name === "Uncatalogued systems topic");
  assert.equal(unmappedReadiness.status, "unmapped");
  await driver.get(`${clientUrl}/dashboard`);
  const readinessNavLink = await driver.wait(until.elementLocated(By.css(".sidebar a[href='/readiness']")), 10000);
  assert.equal(await readinessNavLink.isDisplayed(), true, "My Readiness should be present in primary navigation");
  await readinessNavLink.click();
  await driver.wait(until.elementLocated(By.xpath("//h1[normalize-space()='My Readiness']")), 10000);
  await driver.wait(until.elementLocated(By.id("readiness-goal")), 10000);
  await driver.wait(until.elementLocated(By.xpath("//*[contains(.,'Counts show the latest submitted outcome for each point.')]") ), 10000);
  await writeFile(path.join(screenshotDirectory, "readiness-evidence.png"), Buffer.from(await driver.takeScreenshot(), "base64"));
  assert.equal(await driver.findElements(By.xpath("//*[contains(.,'No submitted recall evidence yet.')]")).then((items) => items.length), 0, "Readiness should not call the submitted canonical assessment unassessed");
  assert.ok(await driver.findElement(By.css(".readiness-actions a[href='/review']")), "Readiness should offer a distinct Review & Improve action");
  assert.ok(await driver.findElement(By.css(".readiness-actions a[href='/knowledge']")), "Readiness should link to the canonical knowledge map");

  // Add one submitted, point-mapped fixture to this disposable learner. Readiness must
  // switch from unassessed to the actual latest persisted outcome and timestamp.
  const readinessAttempt = (await pool.query(
    `INSERT INTO recall_attempts(user_id,concept_id,study_session_id,question_type,question,answer,confidence,submitted_at)
     VALUES($1,$2,$3,'descriptive','Readiness E2E evidence','Freshness is reuse while fresh; validation checks a stale response.',8,now()) RETURNING id`,
    [learnerId, mappedPersonalConcept.id, canonicalSessionId],
  )).rows[0];
  const readinessEvaluation = (await pool.query(
    `INSERT INTO recall_evaluations(recall_attempt_id,overall_coverage,feedback,suggested_recall_type,evaluator_version)
     VALUES($1,0.5,'Disposable readiness evidence','short_explanation','e2e-fixture') RETURNING id`,
    [readinessAttempt.id],
  )).rows[0];
  await pool.query(
    `INSERT INTO recall_knowledge_point_results(evaluation_id,point,status,evidence,feedback,canonical_knowledge_point_id)
     VALUES($1,$2,'partial','Freshness is reuse while fresh; validation checks a stale response.','Partial fixture evidence',$3)`,
    [readinessEvaluation.id, concept.knowledgePoints[0].statement, concept.knowledgePoints[0].id],
  );
  await driver.navigate().refresh();
  await driver.wait(until.elementLocated(By.xpath("//dt[normalize-space()='Partial']/following-sibling::dd[normalize-space()='1']")), 10000);
  await driver.wait(until.elementLocated(By.xpath(`//dt[normalize-space()='No submitted evidence']/following-sibling::dd[normalize-space()='${mappedReadiness.totalPoints - 1}']`)), 10000);
  await driver.wait(until.elementLocated(By.xpath("//*[contains(.,'Latest submitted evidence')]") ), 10000);
  await driver.get(`${clientUrl}/review`);
  await driver.wait(until.elementLocated(By.xpath("//h1[normalize-space()='Choose what to strengthen']")), 10000);
  await writeFile(path.join(screenshotDirectory, "review-improve.png"), Buffer.from(await driver.takeScreenshot(), "base64"));
  assert.match(await driver.findElement(By.css(".page-header")).getText(), /due reviews follow your saved schedule/i, "Review & Improve should explain actionable due work, distinct from the evidence summary");
  await driver.get(`${clientUrl}/goals/${dailyPlanGoalId}`);
  await driver.wait(until.elementLocated(By.id("canonical-skill")), 10000);
  assert.equal(await driver.findElement(By.xpath("//button[normalize-space()='Start baseline assessment']")).isDisplayed(), true);
  await driver.findElement(By.css("input[type='checkbox']")).click();
  assert.equal(await driver.findElement(By.xpath("//button[normalize-space()='Continue without baseline']")).isDisplayed(), true);
  assert.match(await driver.findElement(By.css("form.goal-baseline-form")).getText(), /starts without assessment evidence/i);
  await driver.findElement(By.css("input[type='checkbox']")).click();
  await driver.get(`${clientUrl}/goals/${dailyPlanGoalId}/readiness`);
  await driver.wait(until.elementLocated(By.xpath("//h1[normalize-space()='My Readiness']")), 10000);
  for (const label of ["Incorrect", "Partial", "Unanswered", "No submitted evidence"]) {
    await driver.wait(until.elementLocated(By.xpath(`//dt[normalize-space()='${label}']`)), 10000);
  }
  await driver.wait(until.elementLocated(By.xpath("//*[contains(.,'No exact canonical skill mapping is available yet')]") ), 10000);
  const pendingRecallAttemptId = generatedAssessment.body.questions[0].id;
  await pool.query("UPDATE review_states SET due_at=now() + interval '30 days' WHERE user_id=$1", [learnerId]);
  await pool.query(
    `INSERT INTO review_states (user_id,concept_id,state,due_at,interval_days)
     VALUES ($1,$2,'review',now() - interval '1 day',1)
     ON CONFLICT (user_id,concept_id) DO UPDATE SET due_at=EXCLUDED.due_at,interval_days=EXCLUDED.interval_days`,
    [learnerId, createdStudy.body.concepts[0].id],
  );
  await driver.get(`${clientUrl}/dashboard`);
  await driver.wait(until.elementLocated(By.xpath(`//a[@href='/recall/${pendingRecallAttemptId}']`)), 10000);
  assert.match(await driver.findElement(By.css(".home-continuation")).getText(), /due according to your saved review schedule/i, "A returning learner with due work should see the recall as the useful continuation");
  for (const label of ["Test my knowledge", "Learn something new", "Review and improve"]) assert.ok(await driver.findElement(By.xpath(`//h2[normalize-space()='${label}']`)), `Returning learners should retain ${label}`);
  await driver.get(`${clientUrl}/review`);
  await driver.wait(until.elementLocated(By.xpath("//h2[normalize-space()='Due now']")), 10000);
  const reviewStartLink = await driver.findElement(By.xpath(`//a[contains(@href,'/recall/${pendingRecallAttemptId}?returnTo=')]`));
  await reviewStartLink.click();
  await driver.wait(until.urlContains(`/recall/${pendingRecallAttemptId}?returnTo=`), 10000);
  assert.ok((await driver.getCurrentUrl()).includes("%2Freview"), "Review and Improve should preserve its return path into the due recall");
  const generatedPlan = await learnerApi("POST", `/api/goals/${dailyPlanGoalId}/plan/generate`, { availableMinutes: 120 });
  assert.equal(generatedPlan.status, 201);
  const scheduledRecall = generatedPlan.body.tasks.find((task) => task.recallAttemptId === pendingRecallAttemptId);
  assert.ok(scheduledRecall, "A due review state and unanswered recall attempt should produce a recall task");
  assert.equal(scheduledRecall.requiredness, "must");
  const utcToday = new Date(); utcToday.setUTCHours(0, 0, 0, 0);
  assert.ok(new Date(scheduledRecall.scheduledFor) >= utcToday, "An overdue recall should be rescheduled into the UTC day so it remains visible today");
  await driver.get(`${clientUrl}/plan?goalId=${dailyPlanGoalId}`);
  await driver.wait(until.elementLocated(By.xpath("//h1[normalize-space()='A learning journey for today']")), 10000);
  await driver.wait(async () => {
    const body = await driver.findElement(By.tagName("body")).getText();
    return body.includes("Required") && body.includes("Mark complete") && body.includes("Keep for later today");
  }, 10000);
  const visiblePlan = await driver.findElement(By.tagName("body")).getText();
  assert.ok(visiblePlan.includes("Required") && visiblePlan.includes("Mark complete"), "The UI should render the required recall and an explicit completion action");
  const recallCard = await driver.findElement(By.css(`[data-task-id='${scheduledRecall.id}']`));
  await recallCard.findElement(By.xpath(".//button[contains(.,'Start recall') or contains(.,'Start this step')]")).click();
  await driver.wait(until.urlContains(`/recall/${pendingRecallAttemptId}?returnTo=`), 10000);
  await driver.wait(until.elementLocated(By.css("form")), 15000);
  const answerField = await driver.findElements(By.id("answer"));
  if (answerField.length) await answerField[0].sendKeys("Freshness tells a cache how long a response may be reused; validation checks with the origin whether stale content changed.");
  else {
    const partFields = await driver.findElements(By.css(".structured-answer-parts textarea"));
    if (partFields.length) for (const field of partFields) await field.sendKeys("Freshness tells a cache how long a response may be reused; validation checks with the origin whether stale content changed.");
    else await driver.findElement(By.css("label.option input[type='radio']")).click();
  }
  await driver.findElement(By.css("form button[type='submit']")).click();
  await driver.wait(until.urlContains(`/recall/${pendingRecallAttemptId}/result?returnTo=`), 15000);
  await driver.wait(until.elementLocated(By.xpath("//a[normalize-space()='Done for now']")), 15000);
  await driver.findElement(By.xpath("//a[normalize-space()='Done for now']")).click();
  await driver.wait(until.urlContains("/plan"), 10000);
  const learningTask = generatedPlan.body.tasks.find((task) => task.taskType === "learn");
  assert.ok(learningTask, "The goal should provide a Learn task with a supported study handoff");
  const learningCard = await driver.findElement(By.css(`[data-task-id='${learningTask.id}']`));
  await learningCard.findElement(By.xpath(".//button[normalize-space()='Study this topic']")).click();
  await driver.wait(until.urlContains("/study/new?topic="), 10000);
  const studyHandoffUrl = new URL(await driver.getCurrentUrl());
  assert.equal(studyHandoffUrl.searchParams.get("returnTo"), "/plan/today", "A plan Learn task should preserve its return destination");
  assert.equal(await driver.findElement(By.id("study-topic")).getAttribute("value"), learningTask.title.replace(/^Learn\s*[·:]\s*/i, "").trim());
  await driver.findElement(By.xpath("//a[normalize-space()='Today’s plan']")).click();
  await driver.wait(until.urlContains("/plan/today"), 10000);
  const startedLearnStatus = await pool.query("SELECT status FROM plan_tasks WHERE id=$1", [learningTask.id]);
  assert.equal(startedLearnStatus.rows[0].status, "in_progress", "Starting a Learn task should persist its in-progress state before leaving the plan");
  const completedCard = await driver.findElement(By.css(`[data-task-id='${scheduledRecall.id}']`));
  await completedCard.findElement(By.xpath(".//button[normalize-space()='Mark complete']")).click();
  await driver.wait(until.elementLocated(By.xpath("//*[normalize-space()='Completed']")), 10000);
  const doneTask = await pool.query("SELECT status FROM plan_tasks WHERE id=$1", [scheduledRecall.id]);
  assert.equal(doneTask.rows[0].status, "completed", "The completion action should persist to PostgreSQL");
  const deferredTask = generatedPlan.body.tasks.find((task) => task.id !== scheduledRecall.id && task.id !== learningTask.id);
  assert.ok(deferredTask, "Evidence should generate another task for defer and skip workflow checks");
  const visibleAfterCompletion = await driver.findElement(By.tagName("body")).getText();
  assert.ok(visibleAfterCompletion.includes("Skip today"), "The UI should keep skip available as a separate action");
  const deferredCard = await driver.findElement(By.css(`[data-task-id='${deferredTask.id}']`));
  await deferredCard.findElement(By.xpath(".//button[normalize-space()='Keep for later today']")).click();
  const deferredStatus = await pool.query("SELECT status FROM plan_tasks WHERE id=$1", [deferredTask.id]);
  assert.equal(deferredStatus.rows[0].status, "in_progress", "Keep for later should persist in_progress and leave the task on today’s plan");
  await driver.wait(async () => (await driver.findElement(By.css(`[data-task-id='${deferredTask.id}']`)).getText()).includes("In progress"), 10000);
  await deferredCard.findElement(By.xpath(".//button[normalize-space()='Skip today']")).click();
  const skippedTask = await pool.query("SELECT status FROM plan_tasks WHERE id=$1", [deferredTask.id]);
  assert.equal(skippedTask.rows[0].status, "missed", "Skip today should persist the distinct missed status");
  const overdueCandidate = generatedPlan.body.tasks.find((task) => task.id !== scheduledRecall.id && task.id !== deferredTask.id);
  assert.ok(overdueCandidate, "The E2E budget should include a separate task for overdue transition coverage");
  await pool.query("UPDATE plan_tasks SET status='planned',scheduled_for=$2 WHERE id=$1", [overdueCandidate.id, new Date(utcToday.getTime() - 1000)]);
  await driver.navigate().refresh();
  await driver.wait(until.elementLocated(By.xpath("//h1[normalize-space()='A learning journey for today']")), 10000);
  const overdueTask = await pool.query("SELECT status FROM plan_tasks WHERE id=$1", [overdueCandidate.id]);
  assert.equal(overdueTask.rows[0].status, "missed", "The today-plan read should mark prior UTC-day planned work overdue");

  const canonicalSkill = await pool.query(
    `SELECT s.id,s.name,count(DISTINCT c.id)::int AS concepts
     FROM canonical_skills s JOIN role_skills rs ON rs.skill_id=s.id
     JOIN roles r ON r.id=rs.role_id JOIN topics t ON t.skill_id=s.id
     JOIN canonical_concepts c ON c.topic_id=t.id AND c.status='active'
     JOIN knowledge_points kp ON kp.concept_id=c.id
     WHERE r.name='Backend Engineer'
     GROUP BY s.id,s.name ORDER BY concepts DESC,s.name LIMIT 1`,
  );
  assert.ok(canonicalSkill.rows[0]?.id, "A Backend Engineer skill with canonical points is required for baseline E2E");
  const baselineResponse = await learnerApi("POST", "/api/baseline", {
    goalId: goalResponse.body.goal.id,
    skillId: canonicalSkill.rows[0].id,
    level: "familiar",
  });
  assert.equal(baselineResponse.status, 201, `Could not create E2E baseline: ${JSON.stringify(baselineResponse.body)}`);
  const baseline = baselineResponse.body.baseline;
  const firstQuestion = baseline.questions[0];
  const questionCount = Math.min(4, canonicalSkill.rows[0].concepts);
  assert.equal(baseline.questions.length, questionCount, "Baseline generation should create one question per eligible canonical concept up to the familiar limit");
  assert.ok(questionCount >= 2, "The selected skill should contain enough concepts to exercise recovery and completion");

  const invalidSubmission = await learnerApi("POST", `/api/baseline/${baseline.assessment.id}/submit`, {
    questionId: firstQuestion.id,
    answer: "   ",
    confidence: 5,
  });
  assert.equal(invalidSubmission.status, 400, "Blank baseline answers should fail before persistence");
  const untouched = await pool.query(
    "SELECT submitted_at,answer FROM baseline_questions WHERE id=$1",
    [firstQuestion.id],
  );
  assert.equal(untouched.rows[0].submitted_at, null, "Invalid baseline submissions must not write answer evidence");

  const originalAnswer = "E2E original answer: response freshness defines how long a cached response remains fresh; validators support revalidation.";
  await driver.get(`${clientUrl}/baseline/${baseline.assessment.id}`);
  await driver.wait(until.elementLocated(By.id("baseline-answer")), 10000);
  await driver.executeScript((assessmentId) => {
    const originalFetch = window.fetch.bind(window);
    window.__baselineSubmitAttempts = 0;
    window.fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input.url;
      if (url.endsWith(`/api/baseline/${assessmentId}/submit`) && window.__baselineSubmitAttempts === 0) {
        window.__baselineSubmitAttempts += 1;
        const accepted = await originalFetch(input, init);
        window.__baselineFirstResponse = accepted.status;
        if (!accepted.ok) return accepted;
        await accepted.arrayBuffer();
        window.__baselineSubmitAttempts += 1;
        return originalFetch(input, init);
      }
      return originalFetch(input, init);
    };
  }, baseline.assessment.id);
  await driver.findElement(By.id("baseline-answer")).sendKeys(originalAnswer);
  await driver.findElement(By.css("form.question-card button.btn-primary")).click();
  await driver.wait(until.elementLocated(By.xpath(`//span[contains(.,'QUESTION 02 OF ${questionCount}')]`)), 15000);
  const duplicateReplay = await driver.executeScript("return { attempts: window.__baselineSubmitAttempts, firstStatus: window.__baselineFirstResponse }");
  assert.deepEqual(duplicateReplay, { attempts: 2, firstStatus: 200 }, "The browser should retry after the first accepted response is discarded");

  const afterReplay = await pool.query(
    `SELECT bq.answer,bq.submitted_at,ba.status,
       (SELECT count(*)::int FROM learner_knowledge_states lks
        WHERE lks.user_id=ba.user_id AND lks.canonical_concept_id IN
          (SELECT concept_id FROM baseline_questions WHERE assessment_id=ba.id)) AS learner_states
     FROM baseline_questions bq JOIN baseline_assessments ba ON ba.id=bq.assessment_id
     WHERE bq.id=$1`,
    [firstQuestion.id],
  );
  assert.equal(afterReplay.rows[0].answer, originalAnswer, "Duplicate replay must preserve the first accepted answer");
  assert.ok(afterReplay.rows[0].submitted_at, "The first answer should remain submitted");
  assert.equal(afterReplay.rows[0].status, "pending", "The baseline should remain pending while questions are unanswered");
  assert.equal(afterReplay.rows[0].learner_states, 0, "Incomplete baselines should not write final learner-state evidence");

  for (let questionNumber = 2; questionNumber <= questionCount; questionNumber += 1) {
    console.log(`Submitting baseline question ${questionNumber}/${questionCount}`);
    await driver.findElement(By.id("baseline-answer")).sendKeys(`Disposable browser answer ${questionNumber}: explain the main mechanism and one relevant tradeoff.`);
    await driver.findElement(By.css("form.question-card button.btn-primary")).click();
    if (questionNumber < questionCount) {
      const nextQuestion = String(questionNumber + 1).padStart(2, "0");
      await driver.wait(until.elementLocated(By.xpath(`//span[contains(.,'QUESTION ${nextQuestion} OF ${questionCount}')]`)), 15000);
    }
  }
  await driver.wait(until.urlContains(`/baseline/${baseline.assessment.id}/result`), 15000);
  const completed = await learnerApi("GET", `/api/baseline/${baseline.assessment.id}`);
  assert.equal(completed.status, 200);
  assert.equal(completed.body.baseline.assessment.status, "completed");
  assert.ok(completed.body.baseline.assessment.observedMastery !== null, "Submitted point evidence should produce an observed baseline score");
  assert.ok(completed.body.baseline.questions.every((question) => question.submittedAt), "All baseline questions should be persisted as submitted");
  const persistedEvidence = await pool.query(
    `SELECT count(DISTINCT lks.canonical_concept_id)::int AS count
     FROM learner_knowledge_states lks JOIN baseline_questions bq ON bq.concept_id=lks.canonical_concept_id
     WHERE bq.assessment_id=$1 AND lks.user_id=(SELECT id FROM app_users WHERE email=$2) AND lks.last_assessed_at IS NOT NULL`,
    [baseline.assessment.id, email],
  );
  assert.equal(persistedEvidence.rows[0].count, questionCount, "Completion should persist learner evidence for every assessed concept");
  const persistedAnswer = completed.body.baseline.questions.find((question) => question.id === firstQuestion.id)?.answer;
  assert.equal(persistedAnswer, originalAnswer, "The final API report should still expose the original accepted answer");

  const canonicalConcept = await pool.query(
    `SELECT cc.id,cc.name,t.id AS topic_id,kp.statement
     FROM canonical_concepts cc JOIN topics t ON t.id=cc.topic_id
     JOIN knowledge_points kp ON kp.concept_id=cc.id
     WHERE cc.name='Component boundary tradeoffs'
     ORDER BY kp.id LIMIT 1`,
  );
  assert.ok(canonicalConcept.rows[0]?.id, "A curated Component boundary tradeoffs concept is required for Rapid Fire E2E");
  const rapidStudyTitle = "Component boundary tradeoffs";
  const rapidMaterial = `${rapidStudyTitle}\n${canonicalConcept.rows[0].statement}`;
  const rapidStudyResponse = await learnerApi("POST", "/api/study-sessions", {
    title: rapidStudyTitle,
    rawMaterial: rapidMaterial,
  });
  assert.equal(rapidStudyResponse.status, 201, `Could not create curated Rapid Fire study: ${JSON.stringify(rapidStudyResponse.body)}`);
  const rapidConceptId = rapidStudyResponse.body.concepts.find((item) => item.name === rapidStudyTitle)?.id;
  assert.ok(rapidConceptId, "The study should create a personal concept that maps to its canonical concept");
  const rapidAssessmentResponse = await learnerApi("POST", "/api/assessments", { conceptId: rapidConceptId, mode: "rapid_fire" });
  assert.equal(rapidAssessmentResponse.status, 201, `Could not create Rapid Fire: ${JSON.stringify(rapidAssessmentResponse.body)}`);
  const rapidAssessmentId = rapidAssessmentResponse.body.assessment.id;
  await driver.get(`${clientUrl}/assessments/${rapidAssessmentId}`);
  await driver.wait(until.elementLocated(By.xpath("//h1[normalize-space()='Rapid Fire']")), 10000);
  await driver.findElement(By.xpath("//button[contains(.,'Start Rapid Fire')]")).click();
  await driver.wait(until.elementLocated(By.css(".rapid-live-bar")), 10000);
  const rapidAssessment = await learnerApi("GET", `/api/assessments/${rapidAssessmentId}`);
  assert.equal(rapidAssessment.status, 200);
  assert.equal(rapidAssessment.body.questions.length, 5, "Rapid Fire should render its five-question blueprint");
  const firstRapidQuestion = rapidAssessment.body.questions[0];
  assert.equal(firstRapidQuestion.questionType, "mcq", "The curated canonical question should render as an MCQ");
  assert.match(firstRapidQuestion.questionData.prompt, /service architecture/i);
  const hintButton = await driver.findElement(By.xpath("//button[contains(.,'Need a nudge?')]"));
  await hintButton.click();
  await driver.wait(until.elementLocated(By.xpath("//*[contains(.,'Hint 1') and contains(@class,'hint-callout')]")), 10000);
  await driver.findElement(By.xpath("//button[contains(.,'Need a nudge?')]" )).click();
  await driver.wait(until.elementLocated(By.xpath("//*[contains(.,'Hint 2') and contains(@class,'hint-callout')]")), 10000);
  const hintState = await pool.query(
    "SELECT hints_used,max_hint_level FROM recall_attempts WHERE id=$1 AND user_id=(SELECT id FROM app_users WHERE email=$2)",
    [firstRapidQuestion.id, email],
  );
  assert.deepEqual(hintState.rows[0], { hints_used: 2, max_hint_level: 2 }, "Progressive hint reveals should be persisted");
  const answerKey = await pool.query(
    `SELECT q.correct_option_id,q.options FROM recall_attempts r JOIN questions q ON q.id=r.question_id WHERE r.id=$1`,
    [firstRapidQuestion.id],
  );
  const distractor = answerKey.rows[0].options.find((option) => option.id !== answerKey.rows[0].correct_option_id);
  assert.ok(distractor, "The curated MCQ should include a plausible distractor");
  async function chooseDistractor(option) {
    const labels = await driver.findElements(By.css("label.option"));
    for (const label of labels) {
      if ((await label.getText()).trim() === option.text) {
        await label.click();
        return;
      }
    }
    throw new Error(`Rendered MCQ did not include option ${option.id}`);
  }
  await chooseDistractor(distractor);
  await driver.findElement(By.css("form.question-card button[type='submit']")).click();
  await driver.executeScript(() => {
    const originalFetch = window.fetch.bind(window);
    window.__rapidResponses = [];
    window.fetch = async (input, init) => {
      const response = await originalFetch(input, init);
      const url = typeof input === "string" ? input : input.url;
      if (url.includes("/api/recalls/") && url.endsWith("/submit")) {
        window.__rapidResponses.push({ url, status: response.status, body: await response.clone().text() });
      }
      return response;
    };
  });
  for (let position = 2; position <= rapidAssessment.body.questions.length; position += 1) {
    const currentRapidQuestion = rapidAssessment.body.questions[position - 1];
    await driver.wait(until.elementLocated(By.xpath(`//span[contains(.,'QUESTION ${String(position).padStart(2, "0")} OF 5')]`)), 10000);
    if (currentRapidQuestion.questionType === "mcq") {
      const key = await pool.query("SELECT correct_option_id,options FROM questions WHERE id=(SELECT question_id FROM recall_attempts WHERE id=$1)", [currentRapidQuestion.id]);
      const choice = key.rows[0].options.find((option) => option.id !== key.rows[0].correct_option_id);
      await chooseDistractor(choice);
    } else {
      await driver.findElement(By.id("assessment-answer")).sendKeys("A service boundary has network latency and partial failures; separate components when independent scaling or failure isolation justifies that cost.");
    }
    await driver.findElement(By.css("form.question-card button[type='submit']")).click();
    try {
      if (position < rapidAssessment.body.questions.length) {
        await driver.wait(until.elementLocated(By.xpath(`//span[contains(.,'QUESTION ${String(position + 1).padStart(2, "0")} OF 5')]`)), 10000);
      } else {
        await driver.wait(until.elementLocated(By.css(".report-hero")), 10000);
      }
    } catch (error) {
      const responseDetails = await driver.executeScript("return window.__rapidResponses");
      throw new Error(`Rapid Fire question ${position} did not advance: ${JSON.stringify(responseDetails)}; ${error.message}\n${apiProcess.output}`);
    }
  }
  await driver.wait(until.urlContains(`/assessments/${rapidAssessmentId}`), 15000);
  await driver.wait(until.elementLocated(By.css(".report-hero")), 15000);
  await writeFile(path.join(screenshotDirectory, "assessment-report.png"), Buffer.from(await driver.takeScreenshot(), "base64"));
  const rapidResult = await learnerApi("GET", `/api/assessments/${rapidAssessmentId}`);
  assert.equal(rapidResult.status, 200);
  assert.equal(rapidResult.body.assessment.status, "completed");
  const resultSummary = rapidResult.body.result;
  assert.equal(resultSummary.total, 5);
  assert.equal(resultSummary.correct + resultSummary.partial + resultSummary.incorrect + resultSummary.unanswered, 5);
  assert.match(await driver.findElement(By.css(".report-hero")).getText(), /\b\d\/5\b/);
  assert.match(await driver.findElement(By.css(".report-hero")).getText(), new RegExp(resultSummary.maturityStatus));
  assert.ok(await driver.findElements(By.css(".report-band")).then((items) => items.length > 0), "The report should render point-level evidence");

  const groundingTitle = "TCP Congestion Control";
  const groundingPoint = "Slow start increases the congestion window cwnd as acknowledgements arrive.";
  const groundingStudyResponse = await learnerApi("POST", "/api/study-sessions", {
    title: groundingTitle,
    rawMaterial: `${groundingTitle}\n${groundingPoint}`,
  });
  assert.equal(groundingStudyResponse.status, 201, `Could not create grounding fixture: ${JSON.stringify(groundingStudyResponse.body)}`);
  const groundingConceptId = groundingStudyResponse.body.concepts.find((item) => item.name === groundingTitle)?.id;
  assert.ok(groundingConceptId);
  const groundingAssessmentResponse = await learnerApi("POST", "/api/assessments", { conceptId: groundingConceptId, mode: "deep_recall" });
  assert.equal(groundingAssessmentResponse.status, 201);
  const groundingAssessmentId = groundingAssessmentResponse.body.assessment.id;
  await driver.get(`${clientUrl}/assessments/${groundingAssessmentId}`);
  await driver.wait(until.elementLocated(By.id("assessment-answer")), 10000);
  await driver.findElement(By.id("assessment-answer")).sendKeys("I do not know this yet.");
  await driver.findElement(By.css("form.question-card button[type='submit']")).click();
  await driver.wait(until.elementLocated(By.css(".report-hero")), 10000);
  const groundingAssessment = await learnerApi("GET", `/api/assessments/${groundingAssessmentId}`);
  const triggeringAttempt = groundingAssessment.body.questions[0];
  assert.equal(triggeringAttempt.resultStatus, "incorrect", "The weak answer should produce a real evaluated gap");
  await driver.get(`${clientUrl}/learner`);
  await driver.wait(until.elementLocated(By.xpath(`//article[contains(@class,'learner-concept')][.//strong[normalize-space()='${groundingTitle}']]`)), 10000);
  const weakConceptRow = await driver.findElement(By.xpath(`//article[contains(@class,'learner-concept')][.//strong[normalize-space()='${groundingTitle}']]`));
  await weakConceptRow.findElement(By.xpath(".//button[normalize-space()='Practice this concept']")).click();
  await driver.wait(until.urlMatches(/\/assessments\/[0-9a-f-]+$/i), 10000);
  await driver.wait(until.elementLocated(By.css(".assessment-context h1")), 10000);
  assert.match(await driver.findElement(By.css(".assessment-context")).getText(), /TCP Congestion Control/, "The weak-concept practice action should create practice for the selected concept");

  const sourceReference = "https://example.com/e2e-tcp-notes";
  const sourceResponse = await learnerApi("POST", "/api/grounding/sources", {
    title: "E2E TCP Notes",
    text: `TCP congestion control uses cwnd at the sender. ${groundingPoint} This is distinct from receiver flow control, which constrains data using receiver capacity.`,
    sourceType: "markdown",
    reference: sourceReference,
    provenance: { providedBy: "learner", test: true },
  });
  assert.equal(sourceResponse.status, 201, `Could not ingest grounding source: ${JSON.stringify(sourceResponse.body)}`);
  assert.equal(sourceResponse.body.source.processingStatus, "processed");
  const remediationResponse = await learnerApi("POST", `/api/remediations/from-attempt/${triggeringAttempt.id}`);
  assert.equal(remediationResponse.status, 200, `Could not create grounded remediation: ${JSON.stringify(remediationResponse.body)}`);
  const remediation = remediationResponse.body.remediation;
  assert.equal(remediation.status, "ready");
  assert.ok(remediation.sources.some((item) => item.sourceId === sourceResponse.body.source.id && item.reference === sourceReference));
  assert.match(remediation.content.explanation, /cwnd/i);
  await driver.get(`${clientUrl}/remediations/${remediation.id}`);
  await driver.wait(until.elementLocated(By.css(".remediation-explanation")), 10000);
  const sourceLink = await driver.findElement(By.xpath("//a[normalize-space()='Original material']"));
  assert.equal(await sourceLink.getAttribute("href"), sourceReference, "The rendered citation should retain its original source link");
  assert.match(await driver.findElement(By.css(".remediation-explanation")).getText(), /Check yourself/i);
  await driver.findElement(By.xpath("//button[contains(.,'Check what you remember')]")).click();
  await driver.wait(until.urlMatches(/\/recall\/[0-9a-f-]+$/i), 10000);
  const verificationAttemptId = (await driver.getCurrentUrl()).split("/recall/")[1];
  await driver.wait(until.elementLocated(By.id("answer")), 10000);
  await driver.findElement(By.id("answer")).sendKeys(groundingPoint);
  await driver.findElement(By.css("form button[type='submit']")).click();
  await driver.wait(until.urlContains(`/recall/${verificationAttemptId}/result`), 10000);
  const verifiedRemediation = await learnerApi("GET", `/api/remediations/${remediation.id}`);
  assert.equal(verifiedRemediation.status, 200);
  assert.equal(verifiedRemediation.body.remediation.status, "verified");
  assert.equal(verifiedRemediation.body.remediation.improved, true, "The targeted browser answer should demonstrate improved evidence");

  console.log("PASS browser E2E: three Home intents, coverage-safe knowledge-check entry, notes-first learning, goal/onboarding and study, weak-concept remediation/verification, Review and Improve due-review handoff, flexible returning Home, plan status/scheduling, baseline/readiness, canonical evidence, resources, and Rapid Fire feedback");
} catch (error) {
  if (driver) {
    const currentUrl = await driver.getCurrentUrl().catch(() => "unavailable");
    const visibleText = await driver.findElement(By.tagName("body")).getText().catch(() => "unavailable");
    console.error(`Browser state at failure (${currentUrl}):\n${visibleText.slice(-2000)}`);
  }
  const apiProcess = processes.find((processInfo) => processInfo.name === "mock-provider API");
  if (apiProcess?.output) console.error(`API output at failure:\n${apiProcess.output}`);
  throw error;
} finally {
  if (driver) await driver.quit().catch(() => {});
  geckodriver?.kill();
  try {
    await pool.query("DELETE FROM app_users WHERE email = ANY($1::text[])", [[email, foreignAccountEmail].filter(Boolean)]);
  } finally {
    await pool.end();
    for (const processInfo of processes.reverse()) await stopProcess(processInfo);
  }
}
