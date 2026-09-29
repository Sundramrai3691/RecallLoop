import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { Goal } from "../src/models/Goal.js";
import { PlanTask } from "../src/models/PlanTask.js";
import { Skill } from "../src/models/Skill.js";
import { User } from "../src/models/User.js";
import { Plan } from "../src/models/Plan.js";
import { StudySession } from "../src/models/StudySession.js";
import { Concept } from "../src/models/Concept.js";
import { RecallAttempt } from "../src/models/RecallAttempt.js";
import { ReviewState } from "../src/models/ReviewState.js";
import { LearningEvent } from "../src/models/LearningEvent.js";

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
    User.deleteMany({}),
    Goal.deleteMany({}),
    Skill.deleteMany({}),
    Plan.deleteMany({}),
    PlanTask.deleteMany({}),
    StudySession.deleteMany({}),
    Concept.deleteMany({}),
    RecallAttempt.deleteMany({}),
    ReviewState.deleteMany({}),
    LearningEvent.deleteMany({}),
  ]);
});

describe("auth, goals, plans, learner model", () => {
  it("registers, logs in, and protects routes", async () => {
    const register = await request(app)
      .post("/api/auth/register")
      .send({
        name: "Ada",
        email: "ada@example.com",
        password: "StrongPass123!",
      })
      .expect(201);

    expect(register.body.user.email).toBe("ada@example.com");
    expect(register.body.user.passwordHash).toBeUndefined();
    expect(register.body.token).toBeTruthy();

    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: "ada@example.com", password: "StrongPass123!" })
      .expect(200);

    expect(login.body.user.email).toBe("ada@example.com");
    expect(login.body.token).toBeTruthy();

    await request(app).get("/api/auth/me").expect(401);

    const me = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${login.body.token}`)
      .expect(200);

    expect(me.body.user.email).toBe("ada@example.com");

    await request(app).get("/api/study-sessions").expect(401);
  });

  it("rejects duplicate emails and invalid credentials", async () => {
    await request(app)
      .post("/api/auth/register")
      .send({ name: "Ada", email: "ada@example.com", password: "StrongPass123!" })
      .expect(201);

    await request(app)
      .post("/api/auth/register")
      .send({ name: "Ada 2", email: "ada@example.com", password: "StrongPass123!" })
      .expect(409);

    await request(app)
      .post("/api/auth/login")
      .send({ email: "ada@example.com", password: "wrong-password" })
      .expect(401);
  });

  it("creates a goal, skills, and a deterministic plan", async () => {
    const register = await request(app)
      .post("/api/auth/register")
      .send({ name: "Ada", email: "ada@example.com", password: "StrongPass123!" })
      .expect(201);

    const token = register.body.token;
    const goal = await request(app)
      .post("/api/goals")
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "Become a backend engineer",
        goalType: "career",
        targetDate: "2026-12-31",
        weeklyTimeBudgetMinutes: 900,
        description: "Improve backend knowledge and review fundamentals.",
      })
      .expect(201);

    const skillOne = await request(app)
      .post(`/api/goals/${goal.body.goal.id}/skills`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "Redis",
        description: "Cache behavior and invalidation",
        priority: 90,
        targetMastery: 0.8,
      })
      .expect(201);

    const skillTwo = await request(app)
      .post(`/api/goals/${goal.body.goal.id}/skills`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "Message Queues",
        description: "Distributed async communication",
        priority: 70,
        targetMastery: 0.7,
      })
      .expect(201);

    await request(app)
      .post(`/api/goals/${goal.body.goal.id}/plan/generate`)
      .set("Authorization", `Bearer ${token}`)
      .expect(201);

    const today = await request(app)
      .get("/api/plan/today")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(today.body.plan).toBeTruthy();
    expect(today.body.tasks.length).toBeGreaterThan(0);
    expect(today.body.tasks.some((task: any) => task.taskType === "learn")).toBe(true);
    expect(today.body.tasks.some((task: any) => task.taskType === "recall")).toBe(true);
    expect(skillOne.body.skill.goalId).toBe(goal.body.goal.id);
    expect(skillTwo.body.skill.goalId).toBe(goal.body.goal.id);
  });

  it("prevents cross-user access to goals and plans", async () => {
    const first = await request(app)
      .post("/api/auth/register")
      .send({ name: "Ada", email: "ada@example.com", password: "StrongPass123!" })
      .expect(201);

    const second = await request(app)
      .post("/api/auth/register")
      .send({ name: "Bob", email: "bob@example.com", password: "StrongPass123!" })
      .expect(201);

    const goal = await request(app)
      .post("/api/goals")
      .set("Authorization", `Bearer ${first.body.token}`)
      .send({ title: "Ada's goal", goalType: "learning", weeklyTimeBudgetMinutes: 240 })
      .expect(201);

    await request(app)
      .get(`/api/goals/${goal.body.goal.id}`)
      .set("Authorization", `Bearer ${second.body.token}`)
      .expect(403);

    await request(app)
      .get(`/api/goals/${goal.body.goal.id}/plan`)
      .set("Authorization", `Bearer ${second.body.token}`)
      .expect(403);
  });

  it("runs the authenticated goal to recall to learner to updated plan flow", async () => {
    const registered = await request(app)
      .post("/api/auth/register")
      .send({ name: "Ada", email: "ada@example.com", password: "StrongPass123!" })
      .expect(201);
    const auth = { Authorization: `Bearer ${registered.body.token}` };
    const goal = await request(app).post("/api/goals").set(auth).send({ title: "Backend mastery" }).expect(201);
    await request(app).post(`/api/goals/${goal.body.goal.id}/skills`).set(auth).send({ name: "HTTP", priority: 90 }).expect(201);

    const session = await request(app).post("/api/study-sessions").set(auth).send({ title: "HTTP caching", rawMaterial: "Cache headers control freshness." }).expect(201);
    const completed = await request(app).post(`/api/study-sessions/${session.body.session.id}/complete`).set(auth).expect(200);
    const recall = await request(app).post(`/api/recalls/${completed.body.recalls[0].id}/submit`).set(auth).send({ answer: "Cache headers control freshness.", confidence: 4 }).expect(200);
    expect(recall.body.review.lastOutcome).toBeTruthy();

    const learner = await request(app).get("/api/learner/summary").set(auth).expect(200);
    expect(learner.body.totalConcepts).toBe(1);
    expect(learner.body.recentMistakes).toBeDefined();

    const plan = await request(app).post(`/api/goals/${goal.body.goal.id}/plan/generate`).set(auth).expect(201);
    const task = plan.body.tasks[0];
    await request(app).patch(`/api/plan/tasks/${task.id}`).set(auth).send({ status: "completed" }).expect(200);
    const today = await request(app).get("/api/plan/today").set(auth).expect(200);
    expect(today.body.tasks.some((item: any) => item.status === "completed")).toBe(true);
  });
});
