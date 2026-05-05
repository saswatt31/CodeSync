import { vi, describe, it, expect, beforeAll, beforeEach } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";

// ── Hoisted Mock State ───────────────────────────────────────────────────────
// We must use vi.hoisted for variables used inside vi.mock()
const { mockResolvers, TEST_USER_ID, TEST_SESS_ID } = vi.hoisted(() => ({
  mockResolvers: {},
  TEST_USER_ID: "11111111-1111-1111-1111-111111111111",
  TEST_SESS_ID: "22222222-2222-2222-2222-222222222222",
}));

// ── Global Mocks ─────────────────────────────────────────────────────────────
vi.mock("@supabase/supabase-js", () => {
  const chain = {
    select: () => chain,
    eq: () => chain,
    order: () => chain,
    single: vi.fn().mockImplementation(() => {
      const res = mockResolvers.single;
      return res ? res() : Promise.resolve({ data: { id: TEST_USER_ID, username: "test" }, error: null });
    }),
    insert: vi.fn().mockImplementation(() => ({
      select: () => ({
        single: () => Promise.resolve({ data: { id: TEST_SESS_ID, title: "Mock Session" }, error: null })
      })
    })),
    update: () => chain,
    upsert: () => Promise.resolve({ data: {}, error: null }),
  };

  const client = {
    auth: {
      admin: { createUser: vi.fn().mockResolvedValue({ data: { user: { id: "new" } }, error: null }) },
      signInWithPassword: vi.fn().mockResolvedValue({ data: { user: { id: TEST_USER_ID, email: "t@t.com" } }, error: null }),
    },
    from: vi.fn().mockReturnValue(chain),
  };
  return { createClient: () => client };
});

vi.mock("axios", () => {
  const m = {
    request: vi.fn().mockResolvedValue({ data: { stdout: "ok", status: { description: "Accepted" } } }),
    post: vi.fn().mockResolvedValue({ data: { candidates: [{ content: { parts: [{ text: JSON.stringify({ overall_score: 8 }) }] } }] } }),
    create: vi.fn().mockReturnThis(),
  };
  return { default: m, ...m };
});

vi.mock("express-rate-limit", () => ({
  default: () => (req, res, next) => next(),
  rateLimit: () => (req, res, next) => next(),
}));

// ── App Import ───────────────────────────────────────────────────────────────
const { app } = await import("../index.js");

// ── Helpers ───────────────────────────────────────────────────────────────────
const JWT_SECRET = process.env.JWT_SECRET || "test-secret";
const authHeader = () => {
  const token = jwt.sign({ id: TEST_USER_ID, email: "t@t.com", username: "testuser" }, JWT_SECRET);
  return { Authorization: `Bearer ${token}` };
};

beforeEach(() => {
  // Clear any overrides from previous tests
  for (const key in mockResolvers) delete mockResolvers[key];
});

// ── Tests ────────────────────────────────────────────────────────────────────
describe("CodeSync API Stability", () => {
  it("Health check returns 200", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
  });

  it("Auth: Register works with mock DB", async () => {
    // Override to simulate user not found during registration check
    mockResolvers.single = () => Promise.resolve({ data: null, error: null });
    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: "new@test.com", password: "password123", username: "newuser" });
    expect(res.status).toBe(201);
  });

  it("Auth: Login works with mock DB", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "test@test.com", password: "password123" });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });

  it("Sessions: Creation generates invite code", async () => {
    const res = await request(app)
      .post("/api/sessions")
      .set(authHeader())
      .send({ title: "Mock Interview", language: "javascript" });
    expect(res.status).toBe(201);
    expect(res.body.session).toBeDefined();
  });

  it("Execute: Code execution returns stdout", async () => {
    const res = await request(app)
      .post("/api/execute/run")
      .set(authHeader())
      .send({ code: "console.log(1)", language: "javascript" });
    expect(res.status).toBe(200);
    expect(res.body.stdout).toBeDefined();
  });

  it("AI: Review returns structured evaluation", async () => {
    const res = await request(app)
      .post("/api/ai/review")
      .set(authHeader())
      .send({ code: "def f(): pass", language: "python" });
    expect(res.status).toBe(200);
    expect(res.body.review.overall_score).toBeDefined();
  });
});
