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
  const rawUsername = event.queryStringParameters?.username || "";
  const validation = validateUsername(rawUsername);

  if (!validation.valid) {
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store"
      },
      body: JSON.stringify({
        valid: false,
        available: false,
        reason: validation.reason
      })
    };
  }

  const normalized = normalizeUsername(rawUsername);

  try {
    await ensureTable();
    const rows = await sql`SELECT 1 FROM rdrux_users WHERE username = ${normalized} LIMIT 1`;
    const available = rows.length === 0;

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store"
      },
      body: JSON.stringify({
        valid: true,
        available,
        normalized
      })
    };
  } catch (error) {
    console.error("DB check failed", error);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store"
      },
      body: JSON.stringify({
        valid: true,
        available: false,
        error: "db_unavailable"
      })
    };
  }
};
