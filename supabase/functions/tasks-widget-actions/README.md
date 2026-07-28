# Tasks Widget Actions

This Edge Function issues a narrow, expiring completion credential to an authenticated BathOS Tasks companion installation. WidgetKit uses that credential to complete an owned open task without opening the companion app.

The credential cannot read task content or perform arbitrary edits. The raw value is returned once, stored only in the protected native App Group container, and represented centrally by a SHA-256 digest. Issuing another credential for the same owner and installation rotates the previous value.

The function uses Supabase-provided project URL, publishable-key, and secret-key environment values. It requires no additional hand-managed secret.

Deploy with JWT verification disabled because completion requests authenticate with the separate widget credential:

```sh
supabase functions deploy tasks-widget-actions --no-verify-jwt
```

The function still validates ordinary Supabase access tokens before issuing a credential. Completion and revocation accept only `Authorization: Widget <credential>`.
