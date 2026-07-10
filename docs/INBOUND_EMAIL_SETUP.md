# Inbound Email Setup

This guide explains how to configure automatic Genetec CSV ingestion for Exit Compliance Pro using Resend Inbound Email and Supabase.

## Overview

When a Genetec fire exit CSV is emailed to your dedicated inbound address:

1. Resend receives the email and sends an `email.received` webhook to your app
2. The webhook route verifies the signature and processes the email idempotently
3. The app downloads CSV attachments via the Resend Received Email API
4. The CSV runs through the same analytics pipeline as manual browser uploads
5. The original CSV and processed analysis snapshot are stored in Supabase

## Prerequisites

- A deployed Exit Compliance Pro instance (or local dev server with a public tunnel)
- A Resend account with inbound email enabled
- A Supabase project with Postgres and Storage

For step-by-step CLI commands (Supabase, Vercel, Resend), see [DEPLOYMENT.md](./DEPLOYMENT.md).

## 1. Resend inbound email setup

### Receiving address

Choose one of:

- **Resend-managed receiving address** — use the address Resend provides for testing
- **Custom receiving domain** — configure DNS for your domain in Resend Receiving settings

Set the final address in:

```env
INBOUND_REPORT_EMAIL=reports@your-domain.com
```

### Enable inbound email

1. Open the Resend dashboard
2. Go to **Receiving**
3. Add your receiving domain or use the managed receiving address
4. Confirm DNS records if using a custom domain

## 2. Resend webhook setup

1. Go to **Webhooks** in Resend
2. Click **Add Webhook**
3. Set the endpoint URL:

```text
https://your-app-domain.com/api/inbound-email/resend
```

4. Subscribe to the `email.received` event
5. Copy the webhook signing secret into:

```env
RESEND_WEBHOOK_SECRET=whsec_...
```

Also add your Resend API key:

```env
RESEND_API_KEY=re_...
```

## 3. Supabase setup

### Run the migration

Apply the SQL migration in `supabase/migrations/001_inbound_email.sql` to your Supabase Postgres database.

This creates:

- `inbound_emails`
- `imports`

### Create a storage bucket

1. Open Supabase Storage
2. Create a bucket, for example `imports`
3. Keep the bucket private (service role access only)

Set:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_STORAGE_BUCKET=imports
```

Never expose `SUPABASE_SERVICE_ROLE_KEY` to client-side code.

## 4. Environment variables

Add these to your deployment platform and local `.env.local`:

```env
RESEND_API_KEY=
RESEND_WEBHOOK_SECRET=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_STORAGE_BUCKET=
INBOUND_REPORT_EMAIL=
INBOUND_MAX_ATTACHMENT_BYTES=10485760
```

Optional:

- `INBOUND_MAX_ATTACHMENT_BYTES` — maximum CSV attachment size in bytes (default 10 MB)

## 5. Local testing with a public tunnel

Resend webhooks must reach a public HTTPS URL.

1. Start the app:

```bash
npm run dev
```

2. Expose your local server with a tunnel such as ngrok:

```bash
ngrok http 3000
```

3. Configure the Resend webhook endpoint to:

```text
https://your-ngrok-domain.ngrok.app/api/inbound-email/resend
```

4. Email a Genetec CSV to `INBOUND_REPORT_EMAIL`
5. Check:
   - `/imports` for the inbound import row
   - Settings → Inbound email for status details
   - Supabase tables for persisted records

## 6. Production deployment

1. Deploy the Next.js app with all environment variables configured
2. Point the Resend webhook to your production URL
3. Confirm Supabase migration and storage bucket exist
4. Send a test CSV from Genetec or your email client
5. Verify the import appears on `/imports` with status **Processed**

## 7. Configure Genetec to email CSV reports

In Genetec Security Center:

1. Open your fire exit or door event report configuration
2. Schedule or export the report as CSV
3. Set the delivery method to email
4. Use the inbound address from `INBOUND_REPORT_EMAIL`
5. Ensure the attachment is a `.csv` file

Recommended report contents:

- Event time
- Event type
- Door / exit name

Exit Compliance Pro will auto-detect field mapping for standard Genetec exports, including some headerless exports.

## Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| Webhook returns 401 | Invalid `RESEND_WEBHOOK_SECRET` or modified request body |
| Import status **Rejected** | No valid `.csv` attachment found |
| Import status **Failed** | CSV parse error, mapping failure, analytics error, or database/storage error |
| Duplicate webhook ignored | Expected idempotent behaviour using Resend email ID |
| Nothing on `/imports` | Supabase env vars missing or migration not applied |

## Security notes

- Webhook signatures are verified on every request
- Only `.csv` attachments with allowed MIME types are processed
- Attachment file names are sanitized before storage
- Attachment size limits are enforced
- Attachment content is parsed as CSV only; it is never executed
- Secrets are never returned in API responses or client bundles
