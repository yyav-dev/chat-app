import { describe, expect, it } from "bun:test";
import jwt from "jsonwebtoken";
import { env } from "../../src/config/env";

describe("Auth & Token Verification Unit Tests", () => {
  it("should generate a valid JWT payload and verify signature", () => {
    const payload = {
      userId: "test-uuid-456",
      name: "Test User",
      email: "test@example.com",
    };

    const token = jwt.sign(payload, env.jwtSecret, { expiresIn: "1h" });
    expect(typeof token).toBe("string");

    const decoded = jwt.verify(token, env.jwtSecret) as typeof payload;
    expect(decoded.userId).toBe(payload.userId);
    expect(decoded.name).toBe(payload.name);
    expect(decoded.email).toBe(payload.email);
  });

  it("should fail verification with invalid secret", () => {
    const payload = { userId: "test-uuid-456" };
    const token = jwt.sign(payload, "different-secret", { expiresIn: "1h" });

    expect(() => {
      jwt.verify(token, env.jwtSecret);
    }).toThrow();
  });
});
