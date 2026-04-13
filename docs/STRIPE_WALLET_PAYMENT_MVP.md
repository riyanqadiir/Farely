# Stripe Wallet + Payment MVP Setup

This project now supports an MVP wallet and ride payment flow with three methods:

- `cash` (records pending cash collection)
- `wallet` (debits user wallet balance)
- `card` (charges saved Stripe-backed payment method)

## Environment Variables

### Backend (`backend/.env`)

Required:

- `STRIPE_SECRET_KEY`

Optional for phase 2 webhook work:

- `STRIPE_WEBHOOK_SECRET`

### Frontend (Expo env)

Required:

- `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY`

## Backend API Added/Updated

- `GET /payment-methods`
- `POST /payment-methods`
- `PATCH /payment-methods/:id`
- `DELETE /payment-methods/:id`
- `POST /wallet/topup` (card-only top-up path)
- `POST /wallet/pay` (cash/card/wallet settlement)

## Frontend Flow

1. Add/select card in `Payment Methods`.
2. Top up wallet from `Wallet` using selected card.
3. Select ride payment method before booking in `Ride options`.
4. Complete payment in `Payment` screen with method-specific behavior:
   - `cash`: shows pay-driver amount
   - `card`: charges selected card
   - `wallet`: debits balance
5. Receipt details are shown after payment and wallet top-up.

## Stripe Test Mode Notes

Current MVP is wired for test-mode card methods by brand token mapping in backend:

- `visa` -> `pm_card_visa`
- `mastercard` -> `pm_card_mastercard`

For production, replace this with full client-side Payment Element/CardField capture and server-side token confirmation + webhook reconciliation.
