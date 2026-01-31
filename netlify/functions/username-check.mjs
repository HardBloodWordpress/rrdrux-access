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
  if (req.method !== "GET") {
    return jsonResponse(405, { ok: false, message: "Method Not Allowed" });
  }

  const url = new URL(req.url);
  const username = normalizeUsername(url.searchParams.get("username"));
  const email = normalizeEmail(url.searchParams.get("email"));

  if (!username || username.length < 2) {
    return jsonResponse(400, {
      ok: false,
      available: false,
      reason: "invalid"
    });
  }

  try {
    const sql = createSql();
    await ensureUsersTable(sql);

    const rows = await sql(
      `SELECT email FROM ${USER_TABLE} WHERE username = $1 LIMIT 1`,
      [username]
    );

    if (rows.length === 0) {
      return jsonResponse(200, { ok: true, available: true, username });
    }

    const ownerEmail = normalizeEmail(rows[0].email);
    const ownedByRequester = email && ownerEmail === email;

    return jsonResponse(200, {
      ok: true,
      available: ownedByRequester,
      owned: ownedByRequester,
      username
    });
  } catch (error) {
    console.error("Username check failed", error);
    return jsonResponse(500, {
      ok: false,
      available: false,
      reason: "error"
    });
  }
};
