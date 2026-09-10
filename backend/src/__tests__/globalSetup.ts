import { execSync } from "child_process";
import { config } from "dotenv";
import path from "path";

export async function setup() {
  config({ path: path.resolve(process.cwd(), ".env.test"), override: true });

  // Create test database if it doesn't exist
  try {
    execSync("createdb -U postgres -h localhost agilepm_test 2>/dev/null", {
      stdio: "ignore",
      env: { ...process.env, PGPASSWORD: "postgres" },
    });
  } catch {
    // DB already exists — fine
  }

  // Apply all migrations to test DB
  execSync("npx prisma migrate deploy", {
    stdio: "inherit",
    env: {
      ...process.env,
      DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/agilepm_test",
    },
  });
}
