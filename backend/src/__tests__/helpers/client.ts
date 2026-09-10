import supertest from "supertest";
import app from "../../app";

export type Agent = ReturnType<typeof supertest.agent>;

/**
 * Creates a supertest agent that automatically handles CSRF cookies.
 * Call .login() to authenticate before making protected requests.
 */
export class TestClient {
  readonly agent: Agent;
  private csrfToken = "";

  constructor() {
    this.agent = supertest.agent(app);
  }

  /** Seed the CSRF cookie — must be called before any mutating request. */
  async init(): Promise<this> {
    const res = await this.agent.get("/api/auth/csrf");
    this.csrfToken = (res.body as { csrfToken?: string }).csrfToken ?? "";
    return this;
  }

  async register(data: { email: string; password: string; fullName?: string }) {
    const res = await this.agent
      .post("/api/auth/register")
      .set("x-csrf-token", this.csrfToken)
      .send(data);
    // Server rotates CSRF token on register — keep in sync to avoid 403 on next request
    if (res.body && (res.body as { csrfToken?: string }).csrfToken) {
      this.csrfToken = (res.body as { csrfToken: string }).csrfToken;
    }
    return res;
  }

  async login(data: { email: string; password: string }) {
    const res = await this.agent
      .post("/api/auth/login")
      .set("x-csrf-token", this.csrfToken)
      .send(data);
    // Refresh CSRF token after login (server may rotate it)
    if (res.body && (res.body as { csrfToken?: string }).csrfToken) {
      this.csrfToken = (res.body as { csrfToken: string }).csrfToken;
    }
    return res;
  }

  async logout() {
    return this.agent
      .post("/api/auth/logout")
      .set("x-csrf-token", this.csrfToken)
      .send();
  }

  get(url: string) {
    return this.agent.get(`/api${url}`);
  }

  post(url: string, body?: unknown) {
    return this.agent
      .post(`/api${url}`)
      .set("x-csrf-token", this.csrfToken)
      .send(body);
  }

  patch(url: string, body?: unknown) {
    return this.agent
      .patch(`/api${url}`)
      .set("x-csrf-token", this.csrfToken)
      .send(body);
  }

  put(url: string, body?: unknown) {
    return this.agent
      .put(`/api${url}`)
      .set("x-csrf-token", this.csrfToken)
      .send(body);
  }

  del(url: string) {
    return this.agent
      .delete(`/api${url}`)
      .set("x-csrf-token", this.csrfToken);
  }
}

/** Shorthand: creates a client, calls init(), registers a NEW user. */
export async function authenticatedClient(user: { email: string; password: string; fullName?: string }) {
  const client = new TestClient();
  await client.init();
  await client.register(user);
  return client;
}

/** Shorthand: creates a client and logs in an EXISTING user (created via factory). */
export async function loginClient(credentials: { email: string; password: string }) {
  const client = new TestClient();
  await client.init();
  await client.login(credentials);
  return client;
}
