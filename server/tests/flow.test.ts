import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { Concept } from "../src/models/Concept.js";
import { RecallAttempt } from "../src/models/RecallAttempt.js";
import { ReviewState } from "../src/models/ReviewState.js";
import { StudySession } from "../src/models/StudySession.js";

const app = createApp();
let mongo: MongoMemoryServer;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  await Promise.all([
    StudySession.deleteMany({}),
    Concept.deleteMany({}),
    RecallAttempt.deleteMany({}),
    ReviewState.deleteMany({}),
  ]);
});

describe("study → recall vertical slice", () => {
  it("creates a session and extracts concepts", async () => {
    const res = await request(app)
      .post("/api/study-sessions")
      .send({
        title: "Caching",
        sourceType: "notes",
        rawMaterial:
          "Cache Aside Pattern. Application checks the cache first. Cache miss causes database lookup. Fetched result is returned to the application. Fetched result is written into cache.",
      })
      .expect(201);

    expect(res.body.session.title).toBe("Caching");
    expect(res.body.session.status).toBe("in_progress");
    expect(res.body.concepts.length).toBeGreaterThan(0);
    expect(res.body.concepts[0].requiredKnowledgePoints.length).toBeGreaterThan(0);
    expect(await Concept.countDocuments()).toBe(res.body.concepts.length);
  });

  it("creates immediate explain recalls on complete", async () => {
    const created = await request(app)
      .post("/api/study-sessions")
      .send({ title: "TCP", rawMaterial: "Slow start doubles the congestion window each RTT until a threshold." })
      .expect(201);

    const id = created.body.session.id;
    const completed = await request(app).post(`/api/study-sessions/${id}/complete`).expect(200);

    expect(completed.body.session.status).toBe("completed");
    expect(completed.body.recalls.length).toBeGreaterThan(0);
    expect(completed.body.recalls[0].questionType).toBe("explain");
    expect(completed.body.recalls[0].answer).toBeNull();
    expect(completed.body.recalls[0].question).toMatch(/Without looking at your notes/i);
  });

  it("evaluates an answer, stores evaluation, and schedules review", async () => {
    const created = await request(app)
      .post("/api/study-sessions")
      .send({
        title: "Cache Aside Pattern",
        rawMaterial:
          "Application checks the cache first. Cache miss causes database lookup. Fetched result is returned to the application. Fetched result is written into cache.",
      })
      .expect(201);
    const completed = await request(app)
      .post(`/api/study-sessions/${created.body.session.id}/complete`)
      .expect(200);
    const recallId = completed.body.recalls[0].id;

    const submitted = await request(app)
      .post(`/api/recalls/${recallId}/submit`)
      .send({
        answer:
          "The application checks the cache first. On a cache miss it does a database lookup, returns the fetched result to the application, and writes the fetched result into cache.",
        confidence: 7,
      })
      .expect(200);

    expect(submitted.body.recall.evaluation).toBeTruthy();
    expect(submitted.body.recall.evaluation.evaluatorVersion).toMatch(/recallloop/);
    expect(submitted.body.recall.evaluation.knowledgePointResults.length).toBeGreaterThan(0);
    expect(submitted.body.review.dueAt).toBeTruthy();
    expect(submitted.body.review.lastOutcome).toMatch(/again|hard|good|easy/);
    expect(submitted.body.concept.mastery).toBeGreaterThan(0);
  });

  it("rejects duplicate recall submission", async () => {
    const created = await request(app)
      .post("/api/study-sessions")
      .send({ title: "Indexing" })
      .expect(201);
    const completed = await request(app)
      .post(`/api/study-sessions/${created.body.session.id}/complete`)
      .expect(200);
    const recallId = completed.body.recalls[0].id;

    await request(app)
      .post(`/api/recalls/${recallId}/submit`)
      .send({ answer: "An index speeds up lookups using a separate data structure.", confidence: 5 })
      .expect(200);

    const dup = await request(app)
      .post(`/api/recalls/${recallId}/submit`)
      .send({ answer: "again", confidence: 5 })
      .expect(409);

    expect(dup.body.code).toBe("ALREADY_SUBMITTED");
  });

  it("rejects empty answers and unknown recall ids", async () => {
    const created = await request(app).post("/api/study-sessions").send({ title: "X" }).expect(201);
    const completed = await request(app)
      .post(`/api/study-sessions/${created.body.session.id}/complete`)
      .expect(200);

    await request(app)
      .post(`/api/recalls/${completed.body.recalls[0].id}/submit`)
      .send({ answer: "   ", confidence: 3 })
      .expect(400);

    await request(app)
      .post("/api/recalls/aaaaaaaaaaaaaaaaaaaaaaaa/submit")
      .send({ answer: "something", confidence: 3 })
      .expect(404);
  });

  it("does not duplicate pending recalls if complete is called twice", async () => {
    const created = await request(app).post("/api/study-sessions").send({ title: "WS" }).expect(201);
    const id = created.body.session.id;
    const first = await request(app).post(`/api/study-sessions/${id}/complete`).expect(200);
    const second = await request(app).post(`/api/study-sessions/${id}/complete`).expect(200);
    expect(first.body.recalls.length).toBe(second.body.recalls.length);
    expect(await RecallAttempt.countDocuments()).toBe(first.body.recalls.length);
  });

  it("returns pending recalls on GET study session after complete", async () => {
    const created = await request(app).post("/api/study-sessions").send({ title: "Pending" }).expect(201);
    const id = created.body.session.id;
    await request(app).post(`/api/study-sessions/${id}/complete`).expect(200);
    const loaded = await request(app).get(`/api/study-sessions/${id}`).expect(200);
    expect(loaded.body.pendingRecalls.length).toBeGreaterThan(0);
    expect(loaded.body.pendingRecalls[0].answer).toBeNull();
  });

  it("exposes due recalls on the dashboard", async () => {
    const created = await request(app).post("/api/study-sessions").send({ title: "Dashboard topic" }).expect(201);
    await request(app).post(`/api/study-sessions/${created.body.session.id}/complete`).expect(200);

    const dashboard = await request(app).get("/api/dashboard").expect(200);
    expect(dashboard.body.todayDue.length).toBeGreaterThan(0);
    expect(dashboard.body.recentlyStudied[0].title).toBe("Dashboard topic");
    expect(dashboard.body.recallAttemptCount).toBeGreaterThan(0);
  });
});
