const SESSION_COOKIE_NAME = "field_site_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/login") {
      if (request.method === "GET") return renderLoginPage(url);
      if (request.method === "POST") return handleLogin(request, env);
      return methodNotAllowed();
    }

    if (url.pathname === "/logout") {
      return handleLogout();
    }

    const session = await readSession(request, env);
    if (!session.ok) {
      return redirectToLogin(url);
    }

    return env.ASSETS.fetch(request);
  },
};

async function handleLogin(request, env) {
  let form;
  try {
    form = await request.formData();
  } catch {
    return redirect("/login?error=1");
  }

  const username = String(form.get("username") || "").trim();
  const password = String(form.get("password") || "");
  const next = sanitizeNext(String(form.get("next") || "/"));

  const users = parseUsers(env.BASIC_AUTH_USERS || "");
  const expectedPassword = users.get(username);
  if (!expectedPassword || !safeEqual(password, expectedPassword)) {
    return redirect(`/login?error=1&next=${encodeURIComponent(next)}`);
  }

  let token;
  try {
    token = await createSessionToken(
      {
        u: username,
        exp: Date.now() + SESSION_TTL_SECONDS * 1000,
      },
      env
    );
  } catch {
    return new Response("Server is not configured for sessions.", {
      status: 500,
      headers: { "Cache-Control": "no-store" },
    });
  }

  const headers = new Headers({
    Location: next,
    "Cache-Control": "no-store",
  });
  headers.append("Set-Cookie", buildSessionCookie(token, SESSION_TTL_SECONDS));

  return new Response(null, { status: 302, headers });
}

function handleLogout() {
  const headers = new Headers({
    Location: "/login",
    "Cache-Control": "no-store",
  });
  headers.append("Set-Cookie", clearSessionCookie());

  return new Response(null, { status: 302, headers });
}

function renderLoginPage(url) {
  const next = sanitizeNext(url.searchParams.get("next"));
  const hasError = url.searchParams.get("error") === "1";
  const errorHtml = hasError
    ? '<p class="error">اسم المستخدم أو كلمة المرور غير صحيحة.</p>'
    : "";

  const html = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>تسجيل الدخول - Field Site</title>
  <style>
    :root { color-scheme: dark light; }
    body {
      margin: 0;
      min-height: 100dvh;
      font-family: "Readex Pro", "Tajawal", "Noto Sans Arabic", "Segoe UI", sans-serif;
      background: linear-gradient(160deg, #070d1b, #0d162c 42%, #101f3d);
      color: #edf2ff;
      display: grid;
      place-items: center;
    }
    body::before {
      content: "";
      position: fixed;
      inset: 0;
      background:
        radial-gradient(760px 420px at 85% -20%, rgba(72, 115, 255, 0.26), transparent 72%),
        radial-gradient(700px 420px at 8% -18%, rgba(20, 198, 124, 0.13), transparent 68%);
      pointer-events: none;
    }
    .shell {
      width: min(92vw, 430px);
      border-radius: 32px;
      border: 1px solid rgba(129, 156, 223, 0.35);
      background: linear-gradient(165deg, rgba(21, 31, 53, 0.92), rgba(12, 21, 39, 0.92));
      box-shadow: 0 32px 68px rgba(0, 0, 0, 0.45);
      overflow: hidden;
      backdrop-filter: blur(10px);
    }
    .status {
      height: 6px;
      background: linear-gradient(90deg, #22c779, #598dff, #8b77ff);
    }
    .card {
      padding: 26px 22px 24px;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 14px;
    }
    .brand-icon {
      width: 42px;
      height: 42px;
      border-radius: 14px;
      display: grid;
      place-items: center;
      font-size: 22px;
      background: linear-gradient(140deg, #5a8eff, #3b69d8);
      box-shadow: 0 10px 20px rgba(37, 96, 233, 0.28);
    }
    h1 {
      margin: 0;
      font-size: 21px;
      font-weight: 800;
      letter-spacing: -0.2px;
    }
    p.sub {
      margin: 2px 0 18px;
      color: #9ab0db;
      font-size: 13px;
    }
    label {
      display: block;
      margin: 10px 0 6px;
      font-size: 13px;
      color: #b6c6e6;
      font-weight: 700;
    }
    input {
      width: 100%;
      box-sizing: border-box;
      border: 1px solid rgba(117, 140, 189, 0.45);
      border-radius: 14px;
      padding: 11px 12px;
      font-size: 14px;
      background: rgba(13, 22, 39, 0.6);
      color: #edf2ff;
      outline: none;
      transition: border-color .18s ease, box-shadow .18s ease;
    }
    input:focus {
      border-color: #5a8eff;
      box-shadow: 0 0 0 3px rgba(90, 142, 255, 0.18);
    }
    button {
      width: 100%;
      margin-top: 16px;
      border: 1px solid rgba(146, 179, 255, 0.8);
      border-radius: 14px;
      padding: 11px 14px;
      background: linear-gradient(135deg, #5b8cff, #3d70ec);
      color: #fff;
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
      box-shadow: 0 10px 20px rgba(52, 103, 230, 0.34);
    }
    button:hover { filter: brightness(1.06); }
    .hint {
      margin-top: 12px;
      color: #8fa5d0;
      font-size: 11.5px;
      text-align: center;
    }
    .error {
      margin: 0 0 10px;
      color: #ffd7da;
      background: rgba(255, 93, 105, 0.14);
      border: 1px solid rgba(255, 130, 139, 0.45);
      border-radius: 10px;
      padding: 8px 10px;
      font-size: 13px;
    }
    @media (max-width: 520px) {
      .shell {
        width: calc(100vw - 18px);
        border-radius: 24px;
      }
      .card {
        padding: 20px 16px 18px;
      }
    }
  </style>
</head>
<body>
  <main class="shell">
    <div class="status"></div>
    <section class="card">
      <div class="brand">
        <div class="brand-icon">🏗️</div>
        <div>
          <h1>الموقع الميداني</h1>
          <p class="sub">تسجيل الدخول للوصول إلى التطبيق</p>
        </div>
      </div>
      ${errorHtml}
      <form method="post" action="/login" autocomplete="off">
        <input type="hidden" name="next" value="${escapeHtml(next)}">
        <label for="username">اسم المستخدم</label>
        <input id="username" name="username" required>
        <label for="password">كلمة المرور</label>
        <input id="password" name="password" type="password" required>
        <button type="submit">دخول</button>
      </form>
      <div class="hint">نسخة محمية للاستخدام الداخلي فقط</div>
    </section>
  </main>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=UTF-8",
      "Cache-Control": "no-store",
    },
  });
}

async function readSession(request, env) {
  const token = getCookieValue(request.headers.get("Cookie") || "", SESSION_COOKIE_NAME);
  if (!token) return { ok: false };

  const payload = await verifySessionToken(token, env);
  if (!payload) return { ok: false };
  if (typeof payload.exp !== "number" || Date.now() > payload.exp) {
    return { ok: false };
  }

  return { ok: true, username: payload.u };
}

async function createSessionToken(payloadObj, env) {
  const payload = toBase64Url(new TextEncoder().encode(JSON.stringify(payloadObj)));
  const signature = await sign(payload, env);
  return `${payload}.${signature}`;
}

async function verifySessionToken(token, env) {
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;

  const payload = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  const expected = await sign(payload, env);
  if (!safeEqual(signature, expected)) return null;

  try {
    const bytes = fromBase64Url(payload);
    const json = new TextDecoder().decode(bytes);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

async function sign(data, env) {
  const secret = requireSigningSecret(env);
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(data)
  );
  return toBase64Url(new Uint8Array(signature));
}

function requireSigningSecret(env) {
  const secret = (env.SESSION_SECRET || env.BASIC_AUTH_USERS || "").trim();
  if (!secret) throw new Error("Missing signing secret");
  return secret;
}

function redirectToLogin(url) {
  const next = sanitizeNext(`${url.pathname}${url.search}`);
  return redirect(`/login?next=${encodeURIComponent(next)}`);
}

function redirect(location) {
  return new Response(null, {
    status: 302,
    headers: {
      Location: location,
      "Cache-Control": "no-store",
    },
  });
}

function methodNotAllowed() {
  return new Response("Method Not Allowed", {
    status: 405,
    headers: {
      Allow: "GET, POST",
      "Cache-Control": "no-store",
    },
  });
}

function buildSessionCookie(token, maxAgeSeconds) {
  return `${SESSION_COOKIE_NAME}=${token}; Path=/; Max-Age=${maxAgeSeconds}; HttpOnly; Secure; SameSite=Lax`;
}

function clearSessionCookie() {
  return `${SESSION_COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
}

function getCookieValue(cookieHeader, name) {
  const parts = cookieHeader.split(";");
  for (const part of parts) {
    const item = part.trim();
    if (!item) continue;
    const sep = item.indexOf("=");
    if (sep <= 0) continue;
    const key = item.slice(0, sep).trim();
    if (key !== name) continue;
    return item.slice(sep + 1).trim();
  }
  return "";
}

function parseUsers(usersRaw) {
  const map = new Map();
  for (const pair of usersRaw.split(/[\n,]+/)) {
    let p = pair.trim();
    if (!p) continue;
    p = stripQuotes(p);

    const sep = p.indexOf(":");
    if (sep <= 0) continue;

    const username = stripQuotes(p.slice(0, sep).trim());
    const password = stripQuotes(p.slice(sep + 1).trim());
    if (!username || !password) continue;

    map.set(username, password);
  }
  return map;
}

function stripQuotes(value) {
  if (value.length < 2) return value;
  const first = value[0];
  const last = value[value.length - 1];
  if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
    return value.slice(1, -1);
  }
  return value;
}

function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function sanitizeNext(value) {
  if (!value) return "/";
  if (!value.startsWith("/")) return "/";
  if (value.startsWith("//")) return "/";
  return value;
}

function toBase64Url(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  const binary = atob(normalized + padding);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
