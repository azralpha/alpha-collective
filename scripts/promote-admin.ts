import { createPool } from "mysql2/promise";

const targetEmail = "mortalcartoon14@gmail.com";
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to promote the admin account.");
}

const pool = createPool({
  uri: databaseUrl,
  waitForConnections: true,
  connectionLimit: 1,
  maxIdle: 1,
  idleTimeout: 60_000,
  queueLimit: 0,
  enableKeepAlive: true,
});

try {
  const [result] = await pool.query(
    "UPDATE users SET role = 'admin' WHERE LOWER(email) = LOWER(?)",
    [targetEmail]
  );
  const affectedRows = (result as { affectedRows?: number }).affectedRows ?? 0;

  const [rows] = await pool.query<{ email: string | null; role: string }[]>(
    "SELECT email, role FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1",
    [targetEmail]
  );
  const user = rows[0];

  if (!user) {
    throw new Error(
      `No user found for ${targetEmail}. The account must log in once before promotion.`
    );
  }
  if (user.role !== "admin") {
    throw new Error(
      `Admin promotion did not persist; current role is ${user.role}.`
    );
  }

  console.log(
    `[Admin promotion] ${targetEmail} role=${user.role} affectedRows=${affectedRows}`
  );
} finally {
  await pool.end();
}
