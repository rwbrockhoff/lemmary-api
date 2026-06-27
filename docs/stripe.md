# Stripe Billing

Stripe handles subscriptions for non-Shopify stores. Shopify stores bill through
Shopify's own billing instead, since Shopify requires it for App Store apps. Both
providers share the `subscriptions` table, and the provider is chosen by
`store.platform`.

## Flow

- Subscribing uses the Payment Element with a 7-day trial. Because of the trial the
  first invoice is $0, so the frontend confirms a SetupIntent (saves the card) rather
  than a payment.
- The subscription is created `default_incomplete` and stored as `pending`. It flips to
  `active` when the `customer.subscription.updated` webhook arrives with a saved card.
- Cancel sets `cancel_at_period_end` so access lasts until the period ends. Resume
  clears it.

## Env vars

API (`.env`):

- `STRIPE_SECRET_KEY`
- `STRIPE_MONTHLY_PRICE_ID`
- `STRIPE_WEBHOOK_SECRET`

App (`.env.local`):

- `VITE_STRIPE_PUBLISHABLE_KEY`

The client is built lazily, so the API still boots without these set (tests,
Shopify-only setups).

## Local webhooks

The handler verifies Stripe's signature, so you need the CLI forwarding events with a
matching secret:

```
stripe login
stripe listen --forward-to localhost:3001/webhooks/stripe
```

Copy the `whsec_...` it prints into `STRIPE_WEBHOOK_SECRET` and restart the API. Test
with card `4242 4242 4242 4242`, any future expiry and CVC.

## Webhook events

`POST /webhooks/stripe` handles:

- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`

Anything else returns 200 and is ignored. In production, subscribe the dashboard
endpoint to just these three.

## Status mapping

Stripe status maps to our status in `normalizeStripeStatus`:

- `trialing` / `active` → `active` (only once a card is saved, otherwise `pending`)
- `past_due` → `active` (grace period while Stripe retries a failed charge)
- `unpaid` / `paused` → `frozen`
- `canceled` → `cancelled`

Access (`hasAppAccess`) is granted for an `active` subscription, a demo user, or an
account grant.
