import { neon } from "@netlify/neon";

const sql = neon();

function normalizeUsername(value) {
  return value.trim().toLowerCase();
}

function validateUsername(value) {
  const trimmed = value.trim();

  if (!trimmed) {
    return { valid: false, reason: "" };
  }
  if (trimmed.length < 2) {
    return { valid: false, reason: "Минимум 2 символа" };
  }
  if (trimmed.length > 20) {
    return { valid: false, reason: "Не больше 20 символов" };
  }
  if (/\s/.test(trimmed)) {
    return { valid: false, reason: "Без пробелов" };
  }

  return { valid: true, reason: "" };
}

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS rdrux_users (
      username text PRIMARY KEY,
      email text,
      created_at timestamptz DEFAULT now()
    )
  `;
}

export const handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store"
      },
      body: JSON.stringify({ ok: false, error: "method_not_allowed" })
    };
  }

  let payload = {};
  try {
    payload = JSON.parse(event.body || "{}");
  } catch (error) {
    return {
      statusCode: 400,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store"
      },
      body: JSON.stringify({ ok: false, error: "invalid_json" })
    };
  }

  const rawUsername = typeof payload.username === "string" ? payload.username : "";
  const rawEmail = typeof payload.email === "string" ? payload.email.trim() : "";
  const validation = validateUsername(rawUsername);

  if (!validation.valid) {
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store"
      },
      body: JSON.stringify({ ok: false, error: validation.reason || "invalid_username" })
    };
  }

  const normalized = normalizeUsername(rawUsername);

  try {
    await ensureTable();
    await sql`
      INSERT INTO rdrux_users (username, email)
      VALUES (${normalized}, ${rawEmail || null})
      ON CONFLICT (username) DO NOTHING
    `;

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store"
      },
      body: JSON.stringify({ ok: true })
    };
  } catch (error) {
    console.error("DB insert failed", error);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store"
      },
      body: JSON.stringify({ ok: false, error: "db_unavailable" })
    };
  }
};
