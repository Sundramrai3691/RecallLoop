import bcrypt from "bcryptjs";
import { signToken } from "../../lib/auth.js";
import { AppError, conflict } from "../../utils/errors.js";
import { userRepository } from "../../repositories/postgresRepositories.js";
import type { UserRecord } from "../../repositories/types.js";

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export function serializeUser(user: UserRecord) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export async function registerUser(input: RegisterInput) {
  const name = input.name?.trim();
  const email = input.email?.trim().toLowerCase();
  const password = input.password ?? "";

  if (!name || name.length < 2) {
    throw new AppError("Name must be at least 2 characters", 400, "VALIDATION_ERROR");
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new AppError("Valid email is required", 400, "VALIDATION_ERROR");
  }
  if (password.length < 8) {
    throw new AppError("Password must be at least 8 characters long", 400, "VALIDATION_ERROR");
  }

  const existing = await userRepository.findByEmail(email);
  if (existing) {
    throw conflict("A user with that email already exists", "EMAIL_TAKEN");
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await userRepository.create({ name, email, passwordHash });

  return {
    user: serializeUser(user),
    token: signToken({ id: user.id, email: user.email, name: user.name }),
  };
}

export async function loginUser(input: LoginInput) {
  const email = input.email?.trim().toLowerCase();
  const password = input.password ?? "";

  if (!email || !password) {
    throw new AppError("Email and password are required", 400, "VALIDATION_ERROR");
  }

  const user = await userRepository.findByEmail(email);
  if (!user) {
    throw new AppError("Invalid email or password", 401, "INVALID_CREDENTIALS");
  }

  const matches = await bcrypt.compare(password, user.passwordHash);
  if (!matches) {
    throw new AppError("Invalid email or password", 401, "INVALID_CREDENTIALS");
  }

  return {
    user: serializeUser(user),
    token: signToken({ id: user.id, email: user.email, name: user.name }),
  };
}

export async function getCurrentUser(userId: string) {
  const user = await userRepository.findById(userId);
  if (!user) {
    throw new AppError("User not found", 404, "USER_NOT_FOUND");
  }
  return { user: serializeUser(user) };
}
