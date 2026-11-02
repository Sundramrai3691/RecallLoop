import { randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import { describe, expect, it } from "vitest";
import { env } from "../config/env.js";
import { signToken, verifyToken } from "./auth.js";

describe("JWT authentication boundary", () => {
  it("signs HS256 bearer tokens with expiry and accepts the valid identity", () => {
    const user = { id: randomUUID(), email: "learner@example.test", name: "Learner" };
    const token = signToken(user);
    expect(verifyToken(token)).toEqual(user);
    expect(jwt.decode(token)).toMatchObject({ sub: user.id, email: user.email, name: user.name, exp: expect.any(Number) });
  });

  it("rejects malformed, unsupported-algorithm and expired tokens as the same safe 401", () => {
    const invalid = ["not-a-jwt", jwt.sign({ sub: randomUUID(), email: "a@b.test" }, "attacker-key", { algorithm: "HS384" }), jwt.sign({ sub: randomUUID(), email: "a@b.test" }, env.jwtSecret, { algorithm: "HS256", expiresIn: -1 })];
    for (const token of invalid) expect(() => verifyToken(token)).toThrowError(expect.objectContaining({ status: 401, code: "UNAUTHORIZED", message: "Invalid or expired token" }));
  });
});
