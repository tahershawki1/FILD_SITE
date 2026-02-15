# Cloudflare Worker Auth (Login Page + Session)

This worker protects the `field-site` static app with:

- Custom `/login` page
- Username/password validation from Worker Secret
- Signed HttpOnly session cookie

## Prerequisites

- `wrangler` installed (`npx wrangler --version`)
- Logged in to Cloudflare (`npx wrangler login`)

## Configure users

Set one secret with `username:password` pairs separated by commas:

```bash
npx wrangler secret put BASIC_AUTH_USERS
```

Example secret value:

```text
admin:123456,user1:abc789
```

Avoid using `:` or `,` in passwords.

## Optional session signing secret

By default, sessions are signed using `BASIC_AUTH_USERS`.
For better key separation, set a dedicated secret:

```bash
npx wrangler secret put SESSION_SECRET
```

## Deploy

```bash
npx wrangler deploy
```

## Routes

- `GET /login` -> login page
- `POST /login` -> creates session and redirects
- `GET /logout` -> clears session and redirects to login

## Local preview

```bash
npx wrangler dev
```
