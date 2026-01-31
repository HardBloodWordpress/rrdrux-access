import { neon } from "@netlify/neon";

const USER_TABLE = "rdrux_users";

const createSql = () => neon();

async function ensureUsersTable(sql) {
  await sql(
    `CREATE TABLE IF NOT EXISTS ${USER_TABLE} (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      username TEXT UNIQUE NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );`
  );
}

function normalizeUsername(value) {
  return (value || "").trim().toLowerCase();
}

function normalizeEmail(value) {
  return (value || "").trim().toLowerCase();
}

const jsonResponse = (status, payload) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" }
  });

export default async (req) => {
  if (req.method !== "POST") {
    return jsonResponse(405, { ok: false, message: "Method Not Allowed" });
  }

  let payload = {};
  try {
    payload = (await req.json()) || {};
  } catch (error) {
    return jsonResponse(400, { ok: false, message: "Invalid JSON" });
  }

  const username = normalizeUsername(payload.username);
  const email = normalizeEmail(payload.email);

  if (!username || username.length < 2 || !email || !email.includes("@")) {
    return jsonResponse(400, { ok: false, message: "Invalid data" });
  }

  try {
    const sql = createSql();
    await ensureUsersTable(sql);

    const existing = await sql(
      `SELECT email FROM ${USER_TABLE} WHERE username = $1 LIMIT 1`,
      [username]
    );

    if (existing.length > 0 && normalizeEmail(existing[0].email) !== email) {
      return jsonResponse(409, {
        ok: false,
        message: "Username already taken"
      });
    }

    await sql(
      `INSERT INTO ${USER_TABLE} (email, username)
       VALUES ($1, $2)
       ON CONFLICT (email) DO UPDATE
         SET username = EXCLUDED.username,
             updated_at = NOW()`,
      [email, username]
    );

    return jsonResponse(200, { ok: true });
  } catch (error) {
    console.error("Username upsert failed", error);
    return jsonResponse(500, { ok: false, message: "Server error" });
  }
};
