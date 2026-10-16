import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { Pool } from "pg";
import { Builder, By, until } from "selenium-webdriver";
import firefox from "selenium-webdriver/firefox.js";
import { start as startGeckodriver } from "geckodriver";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
dotenv.config({ path: path.join(root, ".env") });

const databaseUrl = new URL(process.env.DATABASE_URL ?? "");
assert(["127.0.0.1", "localhost", "::1"].includes(databaseUrl.hostname), "E2E cleanup is restricted to a loopback PostgreSQL host");
assert.equal(databaseUrl.pathname, "/recallloop", "E2E cleanup is restricted to the local recallloop database");

const email = `e2e-roadmap-${Date.now()}-${Math.random().toString(16).slice(2)}@test.local`;
const password = `E2e-${Math.random().toString(36).slice(2)}-${Date.now()}`;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const options = new firefox.Options().setBinary("C:\\Program Files\\Mozilla Firefox\\firefox.exe").addArguments("-headless");
const apiPort = 3101;
const clientPort = 5174;
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

async function waitForDriver() {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch("http://127.0.0.1:4444/status");
      if (response.ok) return;
    } catch {
      // The driver process is still opening its local port.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Geckodriver did not become ready within 10 seconds");
}

try {
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
    "--host", "127.0.0.1", "--port", String(clientPort), "--strictPort",
  ], path.join(root, "client"), { ...childEnv, API_PROXY_TARGET: apiUrl });
  await waitForUrl(clientUrl, clientProcess);

  geckodriver = await startGeckodriver({ host: "127.0.0.1", port: 4444 });
  await waitForDriver();
  driver = await new Builder().usingServer("http://127.0.0.1:4444").forBrowser("firefox").setFirefoxOptions(options).build();
  await driver.manage().setTimeouts({ implicit: 0, pageLoad: 20000, script: 10000 });
  await driver.get(`${clientUrl}/register`);
  await driver.findElement(By.id("name")).sendKeys("RecallLoop E2E");
  await driver.findElement(By.id("email")).sendKeys(email);
  await driver.findElement(By.id("password")).sendKeys(password);
  await driver.findElement(By.css("button[type='submit']")).click();
  await driver.wait(until.urlContains("/onboarding"), 10000);

  await driver.wait(until.elementLocated(By.css("a[href='/knowledge']")), 10000);
  await driver.findElement(By.css("a[href='/knowledge']")).click();
  await driver.wait(until.elementLocated(By.xpath("//h1[normalize-space()='Knowledge map']")), 10000);
  await driver.wait(until.elementLocated(By.xpath("//h2[normalize-space()='Backend Engineer']")), 10000);
  await driver.findElement(By.xpath("//h2[normalize-space()='Backend Engineer']/ancestor::a")).click();
  await driver.wait(until.elementLocated(By.xpath("//h1[normalize-space()='Backend Engineer']")), 10000);

  const topicElement = await driver.findElement(By.xpath("//h3[normalize-space()='HTTP']/ancestor::section[contains(@class,'card')]"));
  const httpCaching = await topicElement.findElement(By.xpath(".//h4[normalize-space()='HTTP caching']/ancestor::article[contains(@class,'card')]"));
  const summary = await httpCaching.findElement(By.css("summary"));
  const pointSummary = await summary.getText();
  assert.match(pointSummary, /^1 knowledge points$/i, "HTTP caching should render one distinct knowledge point");
  await summary.click();
  const pointText = await httpCaching.findElement(By.xpath(".//li[contains(.,'Can distinguish freshness from validation.')]")).getText();
  assert.match(pointText, /Can distinguish freshness from validation\./);
  await driver.findElement(By.xpath("//h3[normalize-space()='Caching']"));

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
  const http = apiRole.role.skills.flatMap((skill) => skill.topics).find((topic) => topic.name === "HTTP");
  const concept = http?.concepts.find((item) => item.name === "HTTP caching");
  assert.deepEqual(concept?.knowledgePoints.map((point) => point.statement), ["Can distinguish freshness from validation."]);

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
  assert.equal(persistedSessions.rows[0].count, 0, "Rejected study inputs must not leave orphan sessions");

  const token = await driver.executeScript("return localStorage.getItem('recallloop_token')");
  async function learnerApi(method, route, body) {
    const response = await fetch(`${apiUrl}${route}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, body: await response.json() };
  }

  const studyTitle = "E2E cache notes";
  const studySourceUrl = "https://example.com/cache-reference";
  const studyMaterial = "Freshness tells a cache how long a response may be reused. Validation asks the origin server whether a stale response has changed.";
  await driver.get(`${clientUrl}/study/new`);
  await driver.findElement(By.id("study-topic")).sendKeys(studyTitle);
  await driver.findElement(By.id("source-url")).sendKeys(studySourceUrl);
  await driver.findElement(By.id("material")).sendKeys(studyMaterial);
  await driver.findElement(By.css("button[type='submit']")).click();
  await driver.wait(until.urlMatches(/\/study\/[0-9a-f-]+$/i), 15000);
  const createdSessionId = (await driver.getCurrentUrl()).split("/study/")[1];
  const createdStudy = await learnerApi("GET", `/api/study-sessions/${createdSessionId}`);
  assert.equal(createdStudy.status, 200);
  assert.equal(createdStudy.body.session.title, studyTitle);
  assert.equal(createdStudy.body.session.sourceUrl, studySourceUrl, "The source URL should persist as separate provenance");
  assert.equal(createdStudy.body.session.rawMaterial, studyMaterial, "Only supplied notes should be the extraction material");
  assert.ok(createdStudy.body.concepts.length > 0, "Valid notes should persist extracted concepts");
  const extractedText = createdStudy.body.concepts.flatMap((item) => [item.name, item.description, ...item.requiredKnowledgePoints]).join(" ");
  assert.doesNotMatch(extractedText, /https?:\/\/|www\.|example\.com/i, "URLs must not leak into extracted concept data");
  await driver.wait(until.elementLocated(By.xpath(`//h1[normalize-space()='${studyTitle}']`)), 10000);
  await driver.findElement(By.xpath("//button[normalize-space()='rapid fire']")).click();
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

  console.log("PASS browser E2E: roadmap, valid/rejected study, baseline recovery/completion, Rapid Fire/report, grounded remediation citation and verification");
} catch (error) {
  if (driver) {
    const currentUrl = await driver.getCurrentUrl().catch(() => "unavailable");
    const visibleText = await driver.findElement(By.tagName("body")).getText().catch(() => "unavailable");
    console.error(`Browser state at failure (${currentUrl}):\n${visibleText.slice(-2000)}`);
  }
  throw error;
} finally {
  if (driver) await driver.quit().catch(() => {});
  geckodriver?.kill();
  try {
    await pool.query("DELETE FROM app_users WHERE email=$1", [email]);
  } finally {
    await pool.end();
    for (const processInfo of processes.reverse()) await stopProcess(processInfo);
  }
}
