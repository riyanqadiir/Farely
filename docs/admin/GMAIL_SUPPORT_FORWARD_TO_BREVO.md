# Option B: `farely.support@gmail.com` → Brevo → Farely Admin

You keep **Gmail** as the public address customers know. Gmail **forwards** a copy to an address on **your own domain** that Brevo receives via **Inbound parsing**. Brevo POSTs JSON to your admin API; Farely Admin shows the thread; replies go out via Brevo.

**Important:** You cannot point MX for `@gmail.com` at Brevo (Google owns that domain). Forwarding from Gmail to **your** subdomain (e.g. `support@reply.farely.app`) is the correct pattern.

---

## Is it paid?

| Piece | Cost |
|--------|------|
| **Brevo** | Brevo offers a **free** tier to start (limits on how many emails you can *send* per day/month — see [Brevo pricing](https://www.brevo.com/pricing)). **Inbound parsing** and transactional API are normal Brevo features; you only pay if you upgrade for higher volume or extras. There is **no separate fee** to “turn on MX.” |
| **Your domain** | A subdomain like `reply.farely.app` is **free** if you already own `farely.app`. You only add DNS records under that domain. If you **don’t** own a domain yet, buying one is usually about **$10–15/year** from any registrar (Cloudflare, Namecheap, Porkbun, etc.). |
| **MX / TXT records** | **Free** — included with DNS for your domain. |

---

## Scope without a registered domain

A subdomain (e.g. `reply.farely.app`) is defined under an existing **apex domain**; it is not purchased separately. The operator registers the apex domain (typical annual registrar cost on the order of tens of USD); additional hostnames under that zone incur no separate fee.

**Technical constraint:** Brevo Inbound parsing receives mail at addresses on the operator’s domain because MX records are published in that domain’s DNS. Without a registered domain and DNS control, this document’s end-to-end Gmail-forward path cannot be completed.

**Reduced scope until then:**

1. A public mailbox (e.g. Gmail) may serve as the primary channel for reading and sending customer email.
2. Brevo’s free tier may still be used for outbound transactional mail subject to Brevo’s current policy on sender verification.
3. Farely Admin ingests **email** threads via inbound webhooks only after the domain is verified, MX is in place, and forwarding is configured (Phases 1–2). Until then, the Support Inbox still lists **in-app support tickets** (`source: in_app` from the app outbox ingest); see **“What appears in the Support Inbox list”** in [SUPPORT_INBOX_LIFECYCLE_BREVO.md](./SUPPORT_INBOX_LIFECYCLE_BREVO.md).

The Support Inbox lifecycle document states the same boundary under **Operational note — email ingress** in [SUPPORT_INBOX_LIFECYCLE_BREVO.md](./SUPPORT_INBOX_LIFECYCLE_BREVO.md).

---

## What does “own a subdomain” mean?

You are **not** buying something called “reply” by itself.

1. You have (or buy) a **domain**: `farely.app`.
2. In your DNS panel you create a **hostname** `reply` in that zone. The full address becomes **`reply.farely.app`**. That is your **subdomain**.
3. Brevo tells you which **MX** (and often **TXT** for verification) records to add **for that subdomain only** — so only mail addressed to `*@reply.farely.app` is handled by Brevo, not your main website email unless you point that too.

**Where you click:** Log into wherever your domain’s DNS lives (often the same place you bought the domain, or Cloudflare if you moved DNS there) → **DNS** → **Add record** → choose type **MX**, name **`reply`** (or full `reply.farely.app` depending on the form), paste **priority** and **target host** exactly as Brevo shows (e.g. `inbound1.sendinblue.com.`). Add the second MX if Brevo lists two.

---

## Phase 1 — Domain + Brevo Inbound (one-time)

1. **Pick a subdomain** you control, e.g. `reply.farely.app` (not `@gmail.com`).

2. In **Brevo** → *Campaigns* / *Transactional* area → **Inbound parsing** (or *Settings* → domains / inbound, depending on UI version):
   - Add / verify the domain `reply.farely.app` (or your choice) per Brevo’s wizard.

3. **DNS** for that subdomain (at your DNS host, not Gmail):
   - Add the **MX** records Brevo shows (typically priority **10** → `inbound1.sendinblue.com.`, priority **20** → `inbound2.sendinblue.com.` — follow the exact values in Brevo).
   - Wait for DNS to propagate (often minutes, sometimes up to 48h).

4. **Create a dedicated inbox address** on that subdomain for the Gmail forward target, e.g.  
   `support-in@reply.farely.app`  
   (With Brevo inbound + catch-all on the subdomain, mail to that address is accepted; you do not need Google to host that mailbox.)

5. In Brevo, create an **Inbound parsing webhook**:
   - **URL:**  
     `https://<YOUR_PUBLIC_ADMIN_API_HOST>/webhooks/brevo/inbound?token=<YOUR_LONG_RANDOM_TOKEN>`  
     Use the same token as `BREVO_INBOUND_TOKEN` in `farely-admin/backend/.env`.
   - **Type / events:** inbound + `inboundEmailProcessed` (per Brevo docs).
   - **Domain:** the subdomain you delegated (e.g. `reply.farely.app`).

6. **Admin `.env`** (farely-admin backend):

   ```env
   BREVO_INBOUND_DOMAIN=reply.farely.app
   BREVO_INBOUND_TOKEN=<long random secret in the webhook URL>
   BREVO_PUBLIC_SUPPORT_EMAIL=support-in@reply.farely.app
   ```

   Set `BREVO_PUBLIC_SUPPORT_EMAIL` to the **exact address Gmail will forward to** (the Brevo-side address), **not** `farely.support@gmail.com`, unless tests show the parsed payload still lists `farely.support@gmail.com` as a recipient (see “Troubleshooting” below).

7. Restart the **Farely Admin API** so env and `/webhooks` are live over **HTTPS** (Brevo requires a public URL; use ngrok/Cloudflare Tunnel in dev).

---

## Phase 2 — Gmail forwarding (`farely.support@gmail.com`)

### A. Add the forwarding address

1. Sign in to **farely.support@gmail.com**.

2. **Settings** (gear) → **See all settings** → tab **Forwarding and POP/IMAP**.

3. **Forwarding** → *Add a forwarding address*.

4. Enter your Brevo target, e.g. `support-in@reply.farely.app` → **Next** → **Proceed**.

5. Gmail sends a **confirmation code** to `support-in@reply.farely.app`.  
   - That message hits **Brevo** → your **inbound webhook** fires.  
   - Open **Farely Admin → Support Inbox** (or server logs / Mongo `support_messages`) and read the verification email body, **or** check Brevo’s inbound logs if available.  
   - Copy the **confirmation code** from that email.

6. In Gmail, paste the code → confirm → enable:  
   **“Forward a copy of incoming mail to …”** → choose `support-in@reply.farely.app`  
   (Optional: “keep Gmail’s copy in the Inbox” if you want a backup in Gmail.)

### B. Filters (optional)

- **Settings → Filters** → create a filter if you only want certain mail forwarded (e.g. skip newsletters).

### C. Gmail limits

- Consumer Gmail may cap forwarding volume; for high volume, **Google Workspace** with routing rules is more robust.
- If verification never arrives, check spam on Brevo side, webhook logs, and that MX for `reply.farely.app` is correct.

---

## Phase 3 — Outbound + delivery webhooks (Farely Admin)

Same admin `.env` (copy from main Farely `.env` where you already have keys):

```env
BREVO_API_KEY=xkeysib-...
BREVO_SENDER_EMAIL=<verified sender in Brevo>
BREVO_SENDER_NAME=Farely Support
BREVO_WEBHOOK_SECRET=<from Brevo transactional webhook for /webhooks/brevo/events>
```

- **Transactional webhook** in Brevo: URL  
  `https://<YOUR_PUBLIC_ADMIN_API_HOST>/webhooks/brevo/events`  
  with signing secret = `BREVO_WEBHOOK_SECRET`.

- **`BREVO_SENDER_EMAIL`** must be a **verified** sender/domain in Brevo.

Replies from Support Inbox use **Reply-To** `farely+<threadMongoId>@<BREVO_INBOUND_DOMAIN>` so the customer’s **Reply** in Gmail routes back through Brevo into the **same** thread.

---

## What customers see

- They can keep emailing **`farely.support@gmail.com`** (your published address).
- They do **not** need the `reply.farely.app` address unless you choose to publish it later.

---

## Troubleshooting

1. **New threads never appear in Admin**  
   - Confirm the inbound webhook URL is reachable (HTTPS) and `BREVO_INBOUND_TOKEN` matches the query string.  
   - Temporarily set `BREVO_PUBLIC_SUPPORT_EMAIL` to every address you see in Brevo’s sample payload under `To` / `Delivered-To` / `Recipients` until new threads create reliably.

2. **Verification email from Google not visible**  
   - Inspect the first inbound webhook payload in logs or DB; the text often contains “Confirmation code: 123456”.

3. **Replies from Admin bounce**  
   - Check `BREVO_SENDER_EMAIL` verification and API key on the **admin** server, not only the main Farely API.

---

## Quick checklist

| Step | Done |
|------|------|
| Domain `reply.*` verified in Brevo | ☐ |
| MX for subdomain points to Brevo | ☐ |
| Inbound webhook URL + `BREVO_INBOUND_TOKEN` | ☐ |
| `BREVO_PUBLIC_SUPPORT_EMAIL` = Gmail forward **target** | ☐ |
| Gmail forwarding verified + enabled | ☐ |
| `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, transactional webhook | ☐ |

This gives you **Gmail as the public face** and **Brevo + Farely Admin** as the operational pipeline (Option B).
