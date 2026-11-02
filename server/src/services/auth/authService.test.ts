import bcrypt from "bcryptjs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { userRepository } from "../../repositories/postgresRepositories.js";
import { loginUser } from "./authService.js";

afterEach(() => vi.restoreAllMocks());

describe("authentication privacy", () => {
  it("performs a bcrypt comparison for an unknown account and returns the same credential error", async () => {
    vi.spyOn(userRepository, "findByEmail").mockResolvedValue(null);
    const compare = vi.spyOn(bcrypt, "compare").mockResolvedValue(false);
    await expect(loginUser({ email: "missing@example.test", password: "attempted-password" })).rejects.toMatchObject({ status: 401, code: "INVALID_CREDENTIALS", message: "Invalid email or password" });
    expect(compare).toHaveBeenCalledWith("attempted-password", expect.stringMatching(/^\$2[aby]\$12\$/));
  });
});
