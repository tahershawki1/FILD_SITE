const APP_SESSION_COOKIE = "field_site_session";
const ADMIN_SESSION_COOKIE = "field_site_admin_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24;
const USERS_KV_KEY = "users_v1";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/login") {
      if (request.method === "GET") return renderLoginPage(url);
      if (request.method === "POST") return handleAppLogin(request, env);
      return methodNotAllowed();
    }

    if (url.pathname === "/logout") {
      return handleAppLogout();
    }

    if (url.pathname === "/admin/login") {
      if (request.method === "GET") return renderAdminLoginPage(url);
      if (request.method === "POST") return handleAdminLogin(request, env);
      return methodNotAllowed();
    }

    if (url.pathname === "/admin/logout") {
      return handleAdminLogout();
    }

    if (url.pathname === "/admin") {
      return handleAdminPage(request, env, url);
    }

    if (url.pathname === "/admin/users/add") {
      return handleAdminAddUser(request, env);
    }

    if (url.pathname === "/admin/users/delete") {
      return handleAdminDeleteUser(request, env);
    }

    if (url.pathname === "/admin/users/update") {
      return handleAdminUpdateUser(request, env);
    }

    const session = await readSessionFromCookie(
      request,
      env,
      APP_SESSION_COOKIE,
      "app"
    );

    if (!session.ok) {
      return redirectToLogin(url);
    }

    const assetResponse = await env.ASSETS.fetch(request);
    if (!isAppAdminUser(session.username, env)) {
      return assetResponse;
    }

    return injectAdminShortcut(request, assetResponse);
  },
};

async function handleAppLogin(request, env) {
  let form;
  try {
    form = await request.formData();
  } catch {
    return redirect("/login?error=1");
  }

  const username = String(form.get("username") || "").trim();
  const password = String(form.get("password") || "");
  const next = sanitizeNext(String(form.get("next") || "/"));

  const users = await loadUsers(env);
  const expectedPassword = users.get(username);
  const adminUser = (env.ADMIN_USERNAME || "admin").trim();
  const adminPassword = (env.ADMIN_PASSWORD || "").trim();
  const isAdminCredentials =
    !!adminPassword &&
    safeEqual(username, adminUser) &&
    safeEqual(password, adminPassword);

  if ((!expectedPassword || !safeEqual(password, expectedPassword)) && !isAdminCredentials) {
    return redirect(`/login?error=1&next=${encodeURIComponent(next)}`);
  }

  const token = await createSessionToken(
    {
      typ: "app",
      u: username,
      exp: Date.now() + SESSION_TTL_SECONDS * 1000,
    },
    env
  );

  const headers = new Headers({
    Location: next,
    "Cache-Control": "no-store",
  });
  headers.append(
    "Set-Cookie",
    buildSessionCookie(APP_SESSION_COOKIE, token, SESSION_TTL_SECONDS)
  );

  return new Response(null, { status: 302, headers });
}

function handleAppLogout() {
  const headers = new Headers({
    Location: "/login",
    "Cache-Control": "no-store",
  });
  headers.append("Set-Cookie", clearSessionCookie(APP_SESSION_COOKIE));

  return new Response(null, { status: 302, headers });
}

async function handleAdminLogin(request, env) {
  let form;
  try {
    form = await request.formData();
  } catch {
    return redirect("/admin/login?error=1");
  }

  const username = String(form.get("username") || "").trim();
  const password = String(form.get("password") || "");

  const adminUser = (env.ADMIN_USERNAME || "admin").trim();
  const adminPassword = (env.ADMIN_PASSWORD || "").trim();

  if (!adminPassword) {
    return redirect("/admin/login?error=2");
  }

  if (!safeEqual(username, adminUser) || !safeEqual(password, adminPassword)) {
    return redirect("/admin/login?error=1");
  }

  const token = await createSessionToken(
    {
      typ: "admin",
      u: username,
      exp: Date.now() + SESSION_TTL_SECONDS * 1000,
    },
    env
  );

  const headers = new Headers({
    Location: "/admin",
    "Cache-Control": "no-store",
  });
  headers.append(
    "Set-Cookie",
    buildSessionCookie(ADMIN_SESSION_COOKIE, token, SESSION_TTL_SECONDS)
  );

  return new Response(null, { status: 302, headers });
}

function handleAdminLogout() {
  const headers = new Headers({
    Location: "/admin/login",
    "Cache-Control": "no-store",
  });
  headers.append("Set-Cookie", clearSessionCookie(ADMIN_SESSION_COOKIE));

  return new Response(null, { status: 302, headers });
}

async function handleAdminPage(request, env, url) {
  const adminAccess = await requireAdminAccess(request, env);
  if (!adminAccess.ok) {
    return redirect("/admin/login");
  }

  const users = await loadUsers(env);
  const usersArray = [...users.entries()].sort((a, b) =>
    a[0].localeCompare(b[0])
  );

  const mode = hasUsersKv(env) ? "read-write" : "read-only";
  const message = String(url.searchParams.get("msg") || "");
  const error = String(url.searchParams.get("error") || "");

  return renderAdminPage({
    adminUsername: adminAccess.username,
    usersArray,
    mode,
    message,
    error,
  });
}

async function handleAdminAddUser(request, env) {
  if (request.method !== "POST") return methodNotAllowed();

  const adminAccess = await requireAdminAccess(request, env);
  if (!adminAccess.ok) {
    return redirect("/admin/login");
  }

  if (!hasUsersKv(env)) {
    return redirect("/admin?error=KV%20binding%20USERS_KV%20is%20missing");
  }

  let form;
  try {
    form = await request.formData();
  } catch {
    return redirect("/admin?error=Invalid%20form%20data");
  }

  const username = String(form.get("username") || "").trim();
  const password = String(form.get("password") || "").trim();

  if (!isValidUsername(username)) {
    return redirect(
      "/admin?error=Invalid%20username.%20Use%203-32%20chars:%20a-z%20A-Z%200-9%20._-"
    );
  }

  if (!isValidPassword(password)) {
    return redirect("/admin?error=Password%20must%20be%20at%20least%206%20chars");
  }

  const users = await loadUsers(env);
  users.set(username, password);
  await saveUsers(users, env);

  return redirect(`/admin?msg=${encodeURIComponent(`User ${username} saved`)}`);
}

async function handleAdminDeleteUser(request, env) {
  if (request.method !== "POST") return methodNotAllowed();

  const adminAccess = await requireAdminAccess(request, env);
  if (!adminAccess.ok) {
    return redirect("/admin/login");
  }

  if (!hasUsersKv(env)) {
    return redirect("/admin?error=KV%20binding%20USERS_KV%20is%20missing");
  }

  let form;
  try {
    form = await request.formData();
  } catch {
    return redirect("/admin?error=Invalid%20form%20data");
  }

  const username = String(form.get("username") || "").trim();
  if (!username) {
    return redirect("/admin?error=Username%20is%20required");
  }

  const users = await loadUsers(env);
  if (!users.has(username)) {
    return redirect(`/admin?error=${encodeURIComponent(`User ${username} not found`)}`);
  }

  users.delete(username);
  await saveUsers(users, env);

  return redirect(`/admin?msg=${encodeURIComponent(`User ${username} deleted`)}`);
}

async function handleAdminUpdateUser(request, env) {
  if (request.method !== "POST") return methodNotAllowed();

  const adminAccess = await requireAdminAccess(request, env);
  if (!adminAccess.ok) {
    return redirect("/admin/login");
  }

  if (!hasUsersKv(env)) {
    return redirect("/admin?error=KV%20binding%20USERS_KV%20is%20missing");
  }

  let form;
  try {
    form = await request.formData();
  } catch {
    return redirect("/admin?error=Invalid%20form%20data");
  }

  const currentUsername = String(form.get("current_username") || "").trim();
  const newUsername = String(form.get("new_username") || "").trim();
  const newPassword = String(form.get("new_password") || "").trim();

  if (!currentUsername) {
    return redirect("/admin?error=Current%20username%20is%20required");
  }

  if (!isValidUsername(newUsername)) {
    return redirect(
      "/admin?error=Invalid%20new%20username.%20Use%203-32%20chars:%20a-z%20A-Z%200-9%20._-"
    );
  }

  if (!isValidPassword(newPassword)) {
    return redirect("/admin?error=New%20password%20must%20be%20at%20least%206%20chars");
  }

  const users = await loadUsers(env);
  if (!users.has(currentUsername)) {
    return redirect(
      `/admin?error=${encodeURIComponent(`User ${currentUsername} not found`)}`
    );
  }

  if (currentUsername !== newUsername && users.has(newUsername)) {
    return redirect(
      `/admin?error=${encodeURIComponent(`User ${newUsername} already exists`)}`
    );
  }

  users.delete(currentUsername);
  users.set(newUsername, newPassword);
  await saveUsers(users, env);

  return redirect(
    `/admin?msg=${encodeURIComponent(
      `User ${currentUsername} updated to ${newUsername}`
    )}`
  );
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
    body { margin:0; min-height:100dvh; display:grid; place-items:center; font-family:"Readex Pro","Tajawal","Segoe UI",sans-serif; background:#0d162c; color:#edf2ff; }
    .shell { width:min(92vw,430px); border-radius:24px; border:1px solid rgba(129,156,223,.35); background:#111a31; box-shadow:0 24px 60px rgba(0,0,0,.45); overflow:hidden; }
    .status { height:6px; background:linear-gradient(90deg,#22c779,#598dff,#8b77ff); }
    .card { padding:24px 20px; }
    .logo-wrap { width:64px; height:64px; border-radius:16px; overflow:hidden; border:1px solid rgba(117,140,189,.45); margin:0 auto 10px; background:#0b1220; }
    .logo-wrap img { width:100%; height:100%; object-fit:cover; display:block; }
    h1 { margin:0 0 6px; font-size:22px; }
    p.sub { margin:0 0 18px; color:#9ab0db; font-size:13px; }
    label { display:block; margin:10px 0 6px; font-size:13px; color:#b6c6e6; font-weight:700; }
    input { width:100%; box-sizing:border-box; border:1px solid rgba(117,140,189,.45); border-radius:12px; padding:11px 12px; font-size:14px; background:rgba(13,22,39,.6); color:#edf2ff; }
    button { width:100%; margin-top:14px; border:1px solid rgba(146,179,255,.8); border-radius:12px; padding:11px 14px; background:linear-gradient(135deg,#5b8cff,#3d70ec); color:#fff; font-size:14px; font-weight:700; cursor:pointer; }
    .hint { margin-top:12px; color:#8fa5d0; font-size:12px; text-align:center; }
    .links { margin-top:10px; text-align:center; }
    .links a { color:#9db9ff; font-size:12px; text-decoration:none; }
    .error { margin:0 0 10px; color:#ffd7da; background:rgba(255,93,105,.14); border:1px solid rgba(255,130,139,.45); border-radius:10px; padding:8px 10px; font-size:13px; }
  </style>
</head>
<body>
  <main class="shell">
    <div class="status"></div>
    <section class="card">
      <div class="logo-wrap"><img src="/assets/icons/brand-logo.png" alt="Logo"></div>
      <h1>الموقع الميداني</h1>
      <p class="sub">تسجيل الدخول للوصول إلى التطبيق</p>
      ${errorHtml}
      <form method="post" action="/login" autocomplete="off">
        <input type="hidden" name="next" value="${escapeHtml(next)}">
        <label for="username">اسم المستخدم</label>
        <input id="username" name="username" required>
        <label for="password">كلمة المرور</label>
        <input id="password" name="password" type="password" required>
        <button type="submit">دخول</button>
      </form>
      <div class="hint">نسخة محمية للاستخدام الداخلي</div>
    </section>
  </main>
</body>
</html>`;

  return htmlResponse(html);
}

function renderAdminLoginPage(url) {
  const errorCode = String(url.searchParams.get("error") || "");

  let errorHtml = "";
  if (errorCode === "1") {
    errorHtml = '<p class="error">Invalid admin credentials.</p>';
  } else if (errorCode === "2") {
    errorHtml = '<p class="error">ADMIN_PASSWORD secret is missing.</p>';
  }

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Admin Login</title>
  <style>
    body { margin:0; min-height:100dvh; display:grid; place-items:center; font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif; background:#0f172a; color:#e2e8f0; }
    .card { width:min(92vw,420px); background:#111827; border:1px solid #334155; border-radius:16px; padding:20px; }
    h1 { margin:0 0 8px; font-size:22px; }
    p { margin:0 0 14px; color:#94a3b8; font-size:14px; }
    label { display:block; margin:10px 0 6px; font-size:13px; font-weight:600; }
    input { width:100%; box-sizing:border-box; border:1px solid #334155; border-radius:10px; padding:10px; background:#0b1220; color:#e2e8f0; }
    button { width:100%; margin-top:14px; border:0; border-radius:10px; padding:10px; background:#2563eb; color:#fff; font-weight:700; cursor:pointer; }
    .error { margin:0 0 10px; color:#fecaca; background:#7f1d1d; border:1px solid #b91c1c; border-radius:10px; padding:8px; font-size:13px; }
    .back { margin-top:10px; text-align:center; }
    .back a { color:#93c5fd; text-decoration:none; font-size:13px; }
  </style>
</head>
<body>
  <main class="card">
    <h1>Admin Panel</h1>
    <p>Sign in to manage users.</p>
    ${errorHtml}
    <form method="post" action="/admin/login" autocomplete="off">
      <label for="username">Admin username</label>
      <input id="username" name="username" required>
      <label for="password">Admin password</label>
      <input id="password" name="password" type="password" required>
      <button type="submit">Sign in</button>
    </form>
    <div class="back"><a href="/login">Back to app login</a></div>
  </main>
</body>
</html>`;

  return htmlResponse(html);
}

function renderAdminPage({ adminUsername, usersArray, mode, message, error }) {
  const readonly = mode === "read-only";
  const rows = usersArray.length
    ? usersArray
        .map(
          ([username]) => `
<tr>
  <td>${escapeHtml(username)}</td>
  <td>
    <form method="post" action="/admin/users/update" style="margin-bottom:8px;">
      <input type="hidden" name="current_username" value="${escapeHtml(username)}">
      <input type="text" name="new_username" value="${escapeHtml(username)}" placeholder="New username" ${readonly ? "disabled" : ""}>
      <input type="password" name="new_password" placeholder="New password" ${readonly ? "disabled" : ""}>
      <button type="submit" class="btn warning" ${readonly ? "disabled" : ""}>Update</button>
    </form>
    <form method="post" action="/admin/users/delete" onsubmit="return confirm('Delete user ${escapeHtml(
      username
    )}?');">
      <input type="hidden" name="username" value="${escapeHtml(username)}">
      <button type="submit" class="btn danger" ${readonly ? "disabled" : ""}>Delete</button>
    </form>
  </td>
</tr>`
        )
        .join("")
    : '<tr><td colspan="2">No users found.</td></tr>';

  const messageHtml = message
    ? `<p class="alert ok">${escapeHtml(message)}</p>`
    : "";
  const errorHtml = error ? `<p class="alert err">${escapeHtml(error)}</p>` : "";

  const readonlyHtml = readonly
    ? '<p class="alert warn">USERS_KV binding is missing. Add/Delete is disabled. Login still works from BASIC_AUTH_USERS.</p>'
    : "";

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Admin Users</title>
  <style>
    body { margin:0; font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif; background:#0b1220; color:#e2e8f0; }
    .wrap { max-width:920px; margin:0 auto; padding:20px; }
    .head { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:18px; }
    .head h1 { margin:0; font-size:24px; }
    .head p { margin:4px 0 0; color:#94a3b8; font-size:13px; }
    .actions a { color:#93c5fd; text-decoration:none; font-size:13px; margin-inline-start:12px; }
    .grid { display:grid; grid-template-columns:320px 1fr; gap:16px; }
    .card { border:1px solid #334155; border-radius:14px; background:#111827; padding:14px; }
    h2 { margin:0 0 10px; font-size:17px; }
    label { display:block; margin:8px 0 5px; font-size:13px; color:#cbd5e1; }
    input { width:100%; box-sizing:border-box; border:1px solid #334155; border-radius:10px; padding:9px 10px; background:#0b1220; color:#e2e8f0; }
    .btn { border:0; border-radius:10px; padding:8px 10px; font-weight:700; cursor:pointer; }
    .btn.primary { margin-top:10px; width:100%; background:#2563eb; color:#fff; }
    .btn.warning { background:#b45309; color:#fff; margin-bottom:4px; width:100%; }
    .btn.danger { background:#b91c1c; color:#fff; }
    .btn:disabled { opacity:.6; cursor:not-allowed; }
    table { width:100%; border-collapse:collapse; }
    th, td { border-bottom:1px solid #1f2937; padding:10px 8px; text-align:left; font-size:14px; }
    th { color:#94a3b8; font-weight:600; }
    .alert { border-radius:10px; padding:10px 12px; font-size:13px; margin:0 0 12px; }
    .alert.ok { background:#14532d; color:#bbf7d0; border:1px solid #166534; }
    .alert.err { background:#7f1d1d; color:#fecaca; border:1px solid #b91c1c; }
    .alert.warn { background:#78350f; color:#fde68a; border:1px solid #92400e; }
    @media (max-width: 840px) { .grid { grid-template-columns:1fr; } }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="head">
      <div>
        <h1>Admin Users</h1>
        <p>Signed in as ${escapeHtml(adminUsername)}</p>
      </div>
      <div class="actions">
        <a href="/">Open app</a>
        <a href="/admin/logout">Sign out</a>
      </div>
    </div>

    ${messageHtml}
    ${errorHtml}
    ${readonlyHtml}

    <div class="grid">
      <section class="card">
        <h2>Add / Update User</h2>
        <form method="post" action="/admin/users/add" autocomplete="off">
          <label for="username">Username</label>
          <input id="username" name="username" placeholder="user1" required ${readonly ? "disabled" : ""}>
          <label for="password">Password</label>
          <input id="password" name="password" type="password" placeholder="at least 6 chars" required ${readonly ? "disabled" : ""}>
          <button class="btn primary" type="submit" ${readonly ? "disabled" : ""}>Save user</button>
        </form>
      </section>

      <section class="card">
        <h2>Users (${usersArray.length})</h2>
        <table>
          <thead>
            <tr>
              <th>Username</th>
              <th style="width:260px">Actions</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </section>
    </div>
  </div>
</body>
</html>`;

  return htmlResponse(html);
}

async function loadUsers(env) {
  if (hasUsersKv(env)) {
    const raw = await env.USERS_KV.get(USERS_KV_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        return objectToUsersMap(parsed);
      } catch {
        // Fall through to BASIC_AUTH_USERS
      }
    }
  }

  return parseUsers(env.BASIC_AUTH_USERS || "");
}

async function saveUsers(usersMap, env) {
  if (!hasUsersKv(env)) {
    throw new Error("USERS_KV binding is missing");
  }

  const obj = {};
  for (const [username, password] of usersMap.entries()) {
    obj[username] = password;
  }

  await env.USERS_KV.put(USERS_KV_KEY, JSON.stringify(obj));
}

function hasUsersKv(env) {
  return !!env.USERS_KV;
}

function objectToUsersMap(obj) {
  const map = new Map();
  if (!obj || typeof obj !== "object") return map;

  for (const [username, password] of Object.entries(obj)) {
    if (!username || typeof password !== "string") continue;
    map.set(username, password);
  }

  return map;
}

function isValidUsername(username) {
  return /^[A-Za-z0-9._-]{3,32}$/.test(username);
}

function isValidPassword(password) {
  return password.length >= 6;
}

function isAppAdminUser(username, env) {
  const adminUsername = (env.ADMIN_USERNAME || "admin").trim();
  return safeEqual(String(username || ""), adminUsername);
}

async function requireAdminAccess(request, env) {
  const adminSession = await readSessionFromCookie(
    request,
    env,
    ADMIN_SESSION_COOKIE,
    "admin"
  );
  if (adminSession.ok && isAppAdminUser(adminSession.username, env)) {
    return { ok: true, username: adminSession.username };
  }

  const appSession = await readSessionFromCookie(
    request,
    env,
    APP_SESSION_COOKIE,
    "app"
  );
  if (appSession.ok && isAppAdminUser(appSession.username, env)) {
    return { ok: true, username: appSession.username };
  }

  return { ok: false, username: "" };
}

async function injectAdminShortcut(request, response) {
  if (!response || response.status !== 200) return response;
  if (request.method !== "GET") return response;

  const contentType = response.headers.get("Content-Type") || "";
  if (!contentType.includes("text/html")) return response;

  const body = await response.text();
  if (!body.includes("</body>")) return response;
  if (body.includes("id=\"adminShortcutBtn\"")) return response;

  const shortcut = `<a id="adminShortcutBtn" href="/admin" class="btn-icon" title="لوحة الإدارة" aria-label="لوحة الإدارة">⚙️</a>`;
  const marker = '<div class="headActions">';

  let updatedBody;
  if (body.includes(marker)) {
    updatedBody = body.replace(marker, `${marker}${shortcut}`);
  } else {
    // Fallback if header markup changes in the future.
    updatedBody = body.replace("</body>", `${shortcut}</body>`);
  }

  const headers = new Headers(response.headers);
  headers.delete("Content-Length");

  return new Response(updatedBody, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function readSessionFromCookie(request, env, cookieName, expectedType) {
  const token = getCookieValue(request.headers.get("Cookie") || "", cookieName);
  if (!token) return { ok: false };

  const payload = await verifySessionToken(token, env);
  if (!payload) return { ok: false };

  if (payload.typ !== expectedType) return { ok: false };
  if (typeof payload.exp !== "number" || Date.now() > payload.exp) {
    return { ok: false };
  }

  return { ok: true, username: String(payload.u || "") };
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

function htmlResponse(html) {
  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=UTF-8",
      "Cache-Control": "no-store",
    },
  });
}

function buildSessionCookie(name, token, maxAgeSeconds) {
  return `${name}=${token}; Path=/; Max-Age=${maxAgeSeconds}; HttpOnly; Secure; SameSite=Lax`;
}

function clearSessionCookie(name) {
  return `${name}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
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
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
