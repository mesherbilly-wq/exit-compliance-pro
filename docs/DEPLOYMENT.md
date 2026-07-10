# Exit Compliance Pro — deployment commands

Use these commands after the inbound email code is committed. Replace placeholders with your real values. Do not commit secrets.

## 1. Supabase (Postgres + Storage)

### Option A — Supabase CLI (recommended)

```bash
# Install CLI (once)
npm install -g supabase

# Login (browser authorisation required)
supabase login

# Link to your project (project ref required)
supabase link --project-ref YOUR_PROJECT_REF

# Apply migration
supabase db push

# Or run migration SQL directly
supabase db execute --file supabase/migrations/001_inbound_email.sql
```

Create the private storage bucket (Supabase dashboard or SQL):

```sql
insert into storage.buckets (id, name, public)
values ('imports', 'imports', false)
on conflict (id) do nothing;
```

### Option B — Supabase dashboard

1. Open **SQL Editor** → paste `supabase/migrations/001_inbound_email.sql` → Run
2. Open **Storage** → Create bucket `imports` (private)

### Required values

| Variable | Where to find it |
| --- | --- |
| `SUPABASE_URL` | Project Settings → API → Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Project Settings → API → service_role (server only) |
| `SUPABASE_STORAGE_BUCKET` | Bucket name, e.g. `imports` |

---

## 2. Vercel

### Link and deploy

```bash
# Install CLI (once)
npm install -g vercel

# Login (browser authorisation required)
vercel login

# Link repo to a Vercel project (interactive — project must exist or be created)
vercel link

# Set production environment variables (repeat for each var)
vercel env add RESEND_API_KEY production
vercel env add RESEND_WEBHOOK_SECRET production
vercel env add SUPABASE_URL production
vercel env add SUPABASE_SERVICE_ROLE_KEY production
vercel env add SUPABASE_STORAGE_BUCKET production
vercel env add INBOUND_REPORT_EMAIL production

# Optional
vercel env add INBOUND_MAX_ATTACHMENT_BYTES production

# Deploy
vercel --prod
```

After deploy, note your production URL, e.g. `https://exit-compliance-pro.vercel.app`.

---

## 3. Resend (Inbound + Webhook)

These steps require the Resend dashboard (or Resend API with your key).

### Receiving address

1. Resend dashboard → **Receiving**
2. Add a receiving domain or use the managed test address
3. Set `INBOUND_REPORT_EMAIL` to that address

### Webhook

1. Resend dashboard → **Webhooks** → **Add Webhook**
2. Endpoint:

```text
https://YOUR_VERCEL_DOMAIN/api/inbound-email/resend
```

3. Event: `email.received`
4. Copy signing secret → `RESEND_WEBHOOK_SECRET`

### API key

1. Resend dashboard → **API Keys** → Create
2. Copy → `RESEND_API_KEY`

---

## 4. Local development

```bash
cp .env.example .env.local
# Fill in all values in .env.local

npm install
npm run dev
```

For webhook testing locally, expose port 3000 with a tunnel:

```bash
npx ngrok http 3000
```

Point the Resend webhook to:

```text
https://YOUR_NGROK_SUBDOMAIN.ngrok.app/api/inbound-email/resend
```

---

## 5. Verify end-to-end

1. Email a Genetec `.csv` to `INBOUND_REPORT_EMAIL`
2. Check Vercel function logs for `scope: inbound-email`
3. Open `/imports` — inbound row should appear with status **Processed**
4. Open Settings → **Inbound email** — last received / last successful import updated
5. Dashboards should reflect the latest import (local or server, whichever is newer)

---

## 6. Run tests and build locally

```bash
npm test
npm run build
```

---

## What I need from you to finish external setup

Provide (via `.env.local` or Vercel env vars — never commit these):

1. **Resend** — `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`, receiving address for `INBOUND_REPORT_EMAIL`
2. **Supabase** — project ref, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, bucket created
3. **Vercel** — project linked and production URL for the Resend webhook endpoint

I cannot complete Resend DNS, Supabase login, or Vercel login without your browser authorisation.
