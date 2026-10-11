# Google Calendar setup for EIF Compass
Status: Planned integration; callback and dashboard connection are not implemented yet.

1. Open https://console.cloud.google.com/ and select the project that will own EIF Compass OAuth.
2. Enable Google Calendar API.
3. Configure Google Auth Platform branding and audience. For testing, add the lead/intern Google accounts as test users.
4. Create an OAuth client with application type Web application.
5. Register the exact deployed callback: your trusted app origin followed by /api/google/callback. Register a separate local callback only when a local API server supports it. Do not use Supabase's sign-in callback for this separate connection.
6. Set server-side Vercel environment variables:
   - GOOGLE_CLIENT_ID: Web OAuth client ID.
   - GOOGLE_CLIENT_SECRET: Web OAuth client secret.
   - APP_URL: trusted deployed origin, without trailing slash.
   - GOOGLE_REDIRECT_URI: exact registered callback.
   - GOOGLE_TOKEN_ENCRYPTION_KEY: 32 cryptographically random bytes encoded as base64, used for AES-256-GCM.
   - SUPABASE_SERVICE_ROLE_KEY: backend-only database credential; never a VITE_ variable.
7. Retain existing SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, OPENROUTER_API_KEY and OPENROUTER_MODEL.
8. Redeploy only after implementation and migration verification. Each user then signs in to EIF Compass, connects Google from Calendar, grants requested access and reviews records before syncing.

Do not paste secrets into chat or commit them. Test consent/token expiry and production verification requirements depend on Google's current OAuth configuration and scopes.
Planned access: calendar.events plus openid/email. No Gmail access, Drive Picker, invitations, or writes to other people's calendars.
Disconnect removes app access; already-created calendar entries remain.

References:
- https://developers.google.com/identity/protocols/oauth2/web-server
- https://developers.google.com/workspace/calendar/api/auth
- https://developers.google.com/workspace/calendar/api/guides/create-events
- https://supabase.com/docs/guides/storage/security/access-control
