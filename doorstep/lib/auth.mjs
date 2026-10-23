import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const derive = promisify(scrypt);
const digest = (value) => createHash("sha256").update(value).digest("hex");

export class Auth {
  constructor(db) {
    this.db = db;
    db.exec(`CREATE TABLE IF NOT EXISTS owner (id INTEGER PRIMARY KEY CHECK(id=1), username TEXT NOT NULL, salt TEXT NOT NULL, password_hash TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, expires_at INTEGER NOT NULL);`);
    this.attempts = new Map();
  }

  hasOwner() {
    return Boolean(this.db.prepare("SELECT id FROM owner WHERE id=1").get());
  }

  async setup(username, password) {
    if (this.hasOwner())
      throw new Error("This household already has an owner. Please sign in.");
    if (typeof username !== "string" || !/^[a-z0-9._-]{3,32}$/i.test(username))
      throw new Error(
        "Use 3–32 letters, numbers, dots, underscores or hyphens for your username.",
      );
    if (
      typeof password !== "string" ||
      password.length < 12 ||
      password.length > 128
    )
      throw new Error("Choose a password between 12 and 128 characters.");
    const salt = randomBytes(16).toString("hex");
    const key = await derive(password, salt, 64);
    try {
      this.db
        .prepare("INSERT INTO owner VALUES (1,?,?,?)")
        .run(username.toLowerCase(), salt, key.toString("hex"));
    } catch {
      throw new Error("This household already has an owner. Please sign in.");
    }
    return this.issue();
  }

  async login(username, password, ip) {
    const now = Date.now();
    for (const [key, value] of this.attempts)
      if (value.until <= now) this.attempts.delete(key);
    const attempt = this.attempts.get(ip) || { count: 0, until: now + 900000 };
    if (attempt.count >= 5) {
      const error = new Error("Too many attempts. Try again in 15 minutes.");
      error.status = 429;
      throw error;
    }
    attempt.count++;
    this.attempts.set(ip, attempt);
    const owner = this.db.prepare("SELECT * FROM owner WHERE id=1").get();
    const key = await derive(
      typeof password === "string" ? password.slice(0, 128) : "",
      owner?.salt || "doorstep-unconfigured",
      64,
    );
    const match =
      owner &&
      typeof password === "string" &&
      password.length <= 128 &&
      String(username).toLowerCase() === owner.username &&
      timingSafeEqual(key, Buffer.from(owner.password_hash, "hex"));
    if (!match) {
      const error = new Error("The username or password is incorrect.");
      error.status = 401;
      throw error;
    }
    this.attempts.delete(ip);
    return this.issue();
  }

  issue() {
    const token = randomBytes(32).toString("base64url");
    this.db
      .prepare("DELETE FROM sessions WHERE expires_at <= ?")
      .run(Date.now());
    this.db
      .prepare("INSERT INTO sessions VALUES (?,?)")
      .run(digest(token), Date.now() + 43200000);
    return token;
  }

  user(token) {
    if (!token) return null;
    const session = this.db
      .prepare("SELECT expires_at FROM sessions WHERE token_hash=?")
      .get(digest(token));
    if (!session || session.expires_at <= Date.now()) return null;
    return {
      username: this.db.prepare("SELECT username FROM owner WHERE id=1").get()
        ?.username,
    };
  }

  revoke(token) {
    if (token)
      this.db
        .prepare("DELETE FROM sessions WHERE token_hash=?")
        .run(digest(token));
  }
}

export function sessionToken(req) {
  return (req.headers.cookie || "")
    .split(";")
    .map((value) => value.trim())
    .find((value) => value.startsWith("doorstep_session="))
    ?.slice("doorstep_session=".length);
}

export function bearerMatches(header, expected) {
  if (!expected || expected.length < 32 || !header?.startsWith("Bearer "))
    return false;
  const a = Buffer.from(digest(header.slice(7)), "hex");
  const b = Buffer.from(digest(expected), "hex");
  return timingSafeEqual(a, b);
}
