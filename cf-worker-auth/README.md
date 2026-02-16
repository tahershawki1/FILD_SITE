# Cloudflare Worker Auth + Admin Users

This worker protects `field-site` with:

- Custom app login: `/login`
- Signed session cookies
- Admin panel for users management: `/admin`
- CSRF protection for all POST endpoints
- Login rate limiting (per IP)
- Security headers (including CSP on HTML responses)

## Required secrets

Run inside `cf-worker-auth`:

```bash
npx wrangler secret put SESSION_SECRET
npx wrangler secret put ADMIN_USERNAME
npx wrangler secret put ADMIN_PASSWORD
npx wrangler secret put BASIC_AUTH_USERS
```

Notes:

- `SESSION_SECRET` must be long and random (at least 32 chars).
- `ADMIN_USERNAME` and `ADMIN_PASSWORD` are mandatory.
- Use strong passwords only (no weak defaults).
- `BASIC_AUTH_USERS` is fallback seed format: `user1:StrongPass1!,user2:StrongPass2!`

## KV bindings

`USERS_KV` is required for persistent user management.

`AUTH_KV` is required for rate limiting counters.

Example `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "USERS_KV"
id = "<production_users_kv_id>"
preview_id = "<preview_users_kv_id>"

[[kv_namespaces]]
binding = "AUTH_KV"
id = "<production_auth_kv_id>"
preview_id = "<preview_auth_kv_id>"
```

## Password storage

- New/updated users are stored as PBKDF2-SHA256 hashes.
- Legacy plain-text users are supported temporarily.
- On successful legacy login, credentials are automatically migrated to hashed format in `USERS_KV`.

## Routes

- `GET /login` app login page
- `POST /login` app login submit
- `GET /logout` app logout
- `GET /admin/login` admin login page
- `POST /admin/login` admin login submit
- `GET /admin` admin users panel
- `POST /admin/users/add` add or update user
- `POST /admin/users/update` rename user and/or change password
- `POST /admin/users/delete` delete user
- `GET /admin/logout` admin logout

## Deploy

```bash
npx wrangler deploy
```
