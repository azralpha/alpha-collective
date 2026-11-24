# Alpha Market admin API key

Alpha Market accepts a server-configured bearer key as an alternative credential for administrator routes. The key is bound to the existing `OWNER_OPEN_ID` account and works only while that account exists with the `admin` role.

## Request headers

Use either of the following on administrator API requests:

```http
X-Admin-API-Key: <secret>
```

or:

```http
Authorization: Bearer <secret>
```

For tRPC, send the header to the existing `/api/trpc/<procedure>` endpoint. The key authenticates only shared `adminProcedure` operations and explicitly guarded administrator Express routes. It does not create a browser session, does not authenticate ordinary `protectedProcedure` routes, and does not disable Google sign-in.

## Storage and operations

The plaintext key must never be committed to the repository, added to frontend build variables, or written to application logs. Generate a high-entropy key once; configure only its lowercase SHA-256 digest in the Render secret `ADMIN_API_KEY_SHA256`. The server compares the digest using constant-time equality and resolves the configured owner account for audit IDs. Failed admin API-key requests are rate-limited.

Because a bearer credential authorizes whoever possesses it, any person who obtains the plaintext key can exercise the admin API. Keep the downloaded copy private. To revoke it, unset `ADMIN_API_KEY_SHA256` in the Alpha Market Render service and deploy/restart the service. To rotate, generate a new key and digest, update the Render secret, and restart; the previous key stops working after the new deployment starts.
