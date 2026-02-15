# Cloudflare Worker Auth + Admin Users

This worker protects `field-site` with:

- Custom app login: `/login`
- Session cookies (signed)
- Admin panel to manage users: `/admin`

## Required secrets

Run inside `cf-worker-auth`:

```bash
npx wrangler secret put BASIC_AUTH_USERS
npx wrangler secret put SESSION_SECRET
npx wrangler secret put ADMIN_PASSWORD
```

Optional:

```bash
npx wrangler secret put ADMIN_USERNAME
```

- `BASIC_AUTH_USERS` example: `admin:123456,user1:abc789`
- `ADMIN_USERNAME` default: `admin`

## Enable dynamic Add/Delete users (recommended)

Admin add/delete needs a KV binding named `USERS_KV`.

1. Create KV namespace in Cloudflare dashboard.
2. Bind it to this Worker with binding name: `USERS_KV`.

Or with Wrangler:

```bash
npx wrangler kv namespace create USERS_KV
```

Then add binding in `wrangler.toml` (real IDs from your account):

```toml
[[kv_namespaces]]
binding = "USERS_KV"
id = "<production_namespace_id>"
preview_id = "<preview_namespace_id>"
```

If `USERS_KV` is missing:

- login still works from `BASIC_AUTH_USERS`
- admin page opens in read-only mode (cannot add/delete)

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

When a logged-in app user is the admin user (`ADMIN_USERNAME`, default `admin`),
the app UI gets an in-app shortcut button to open `/admin`.

## Deploy

```bash
npx wrangler deploy
```
