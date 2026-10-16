import assert from "node:assert/strict";
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
let geckodriver;
let driver;

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
  for (const url of ["http://localhost:3001/api/health", "http://localhost:5173"]) {
    const response = await fetch(url);
    assert.equal(response.status, 200, `${url} must be available before E2E runs`);
  }

  geckodriver = await startGeckodriver({ host: "127.0.0.1", port: 4444 });
  await waitForDriver();
  driver = await new Builder().usingServer("http://127.0.0.1:4444").forBrowser("firefox").setFirefoxOptions(options).build();
  await driver.manage().setTimeouts({ implicit: 0, pageLoad: 20000, script: 10000 });
  await driver.get("http://localhost:5173/register");
  await driver.findElement(By.id("name")).sendKeys("RecallLoop E2E");
  await driver.findElement(By.id("email")).sendKeys(email);
  await driver.findElement(By.id("password")).sendKeys(password);
  await driver.findElement(By.css("button[type='submit']")).click();
  await driver.wait(until.urlContains("/onboarding"), 10000);

  await driver.wait(until.elementLocated(By.css("a[href='/knowledge']")), 10000);
  await driver.findElement(By.css("a[href='/knowledge']")).click();
  await driver.wait(until.elementLocated(By.xpath("//h1[normalize-space()='Knowledge map']")), 10000);
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

  await driver.get("http://localhost:5173/study/new");
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

  console.log("PASS browser E2E: canonical roadmap/API agreement, adjacent topic rendering, URL-topic and URL-only study rejection, no orphan session");
} finally {
  if (driver) await driver.quit().catch(() => {});
  geckodriver?.kill();
  try {
    await pool.query("DELETE FROM app_users WHERE email=$1", [email]);
  } finally {
    await pool.end();
  }
}
