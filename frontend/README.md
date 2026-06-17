# Farely Mobile App

React Native / Expo dev-client app. Backend is hosted separately on Railway; admin console
lives in the `farely-admin` repo.

---

## Setup

```bash
npm install
```

Create `frontend/.env` for build-time public secrets:

```bash
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=AIzaSy...   # Places autocomplete + static map
EXPO_PUBLIC_API_BASE_URL=https://your-railway-url.up.railway.app
```

Anything that should ship to runtime goes through `app.json` → `extra`. The
Google Maps API key is wired in `extra.googleMapsApiKey` and the native Android
manifest config (see `app.json` → `android.config.googleMaps.apiKey`).

---

## Daily commands (development)

| Goal | Command | Notes |
| --- | --- | --- |
| Start Metro only | `npx expo start` | Pairs with **Expo Go**. Cannot load `expo-maps` or our accessibility service — only useful for pure-JS components. |
| Run Android dev build | `npx expo run:android` | Runs `prebuild`, builds a debug **dev client** with all native modules, installs on the connected device, starts Metro. **Use this for everyday development.** |
| Run iOS dev build | `npx expo run:ios` | Same as above for iOS. Live fare scrape (accessibility service) is Android-only. |
| LAN mode for a phone on the same WiFi | `npm run start:dev` | Wraps `expo start -c` and binds Metro to your LAN IP. |
| Reset native dirs after plugin changes | `npx expo prebuild --clean` then `npx expo run:android` | Required if you edit `plugins/withFareAccessibilityService.js` or change `app.json` plugins/extras. |

> **Why Expo Go does not work for Farely.** Expo Go is sandboxed; it does not
> include `expo-maps`, `@react-native-google-signin/google-signin` (now
> removed), or our custom accessibility service. The "Google Maps doesn't
> work" symptom is usually a sign that the JS is running inside Expo Go
> instead of the dev client. Always launch with `npx expo run:android` /
> `run:ios` for development.

---

## Production build (EAS)

The app ships through **EAS Build** + Google Play Console (Android first; iOS
once you have an Apple Developer account).

### 1) Install + login

```bash
npm install -g eas-cli
cd frontend
eas login
eas whoami           # confirm
```

### 2) Configure profiles

```bash
eas build:configure
```

This creates `frontend/eas.json`. Recommended profiles:

```jsonc
{
  "cli": { "version": ">= 12.0.0" },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "android": { "gradleCommand": ":app:assembleDebug" }
    },
    "preview": {
      "distribution": "internal",
      "android": { "buildType": "apk" }
    },
    "production": {
      "autoIncrement": true,
      "android": { "buildType": "app-bundle" }
    }
  },
  "submit": {
    "production": {
      "android": { "track": "internal" }
    }
  }
}
```

### 3) Preview APK on a real device

```bash
eas build -p android --profile preview
```

EAS returns an install link / QR code. Sideload on a Pakistani test device, run
through: Compare → Open Yango → return → confirm modal → ride logs.

### 4) Production AAB for Play Store

Bump `expo.android.versionCode` (or rely on `autoIncrement`) and:

```bash
eas build -p android --profile production
eas submit -p android --profile production
```

You'll need a **Google Play Console** account ($25 one-time) and a finished
listing (description, screenshots, privacy policy URL).

### 5) iOS later

Once the Apple Developer Program ($99/yr) is set up:

```bash
eas build -p ios --profile production
eas submit -p ios --profile production
```

iOS does **not** support live fare scraping (no accessibility bridge). All
other features still work.

---

## Backend deploy (Railway)

`backend/` is a Node/Express service deployed on Railway. After renewing your
subscription:

1. **Set environment variables** in the Railway service (Settings → Variables):
   - `MONGO_URI` — Atlas connection string
   - `JWT_SECRET`, `JWT_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN`
   - `GOOGLE_MAPS_API_KEY` — required for live traffic-hotspots / surge tiers
   - `BREVO_API_KEY`, `BREVO_SENDER_EMAIL` — email OTP + password reset
   - `AWS_*` — profile photo storage
   - `PAK_PETROL_PKR` (optional) — keep estimates aligned with OGRA prices
2. In Google Cloud Console, ensure the API key has these enabled:
   - Distance Matrix API (live traffic / surge tier)
   - Geocoding API
   - Places API
   - Maps SDK for Android
3. Hit `https://<your-app>.up.railway.app/health` from a browser to confirm
   the deploy is live.
4. Update `frontend/src/config/api.js` (or `EXPO_PUBLIC_API_BASE_URL`) to your
   Railway production URL before running `eas build --profile production`.

### Hotspot / surge troubleshooting

If the Admin Hotspots dashboard shows "no data" for every Lahore zone:

- Confirm `GOOGLE_MAPS_API_KEY` is set in Railway and **Distance Matrix API**
  is enabled in the Google Cloud project.
- Test the endpoint: `GET /rides/traffic-hotspots?city=Lahore` — items should
  return non-null `durationInTraffic`. A `503` response means the env var is
  missing. Items with `durationInTraffic: null` mean the key is set but the
  Distance Matrix API call failed (check API restrictions and billing).
- The first call after a cold start populates the 5-minute cache; subsequent
  calls return instantly. Surge multiplier is `1.0×` until the cache is
  populated.

---

## Project structure quick reference

- `frontend/App.js` — root navigator + auth gate + global capture pipeline
- `frontend/src/screens/` — all UI screens
- `frontend/src/utils/liveFareStore.js` — AsyncStorage scrape cache
- `frontend/src/utils/handoffCaptureSync.js` — PATCH live fare to backend
- `frontend/src/native/accessibilityBridge.js` — Android-only UI_DATA listener
- `frontend/plugins/withFareAccessibilityService.js` — Expo plugin that
  generates the Java accessibility service (writes
  `android/app/src/main/java/com/farely/app/MyAccessibilityService.java`)
- `frontend/android/app/src/main/java/com/farely/app/` — generated Java
  sources (commit them so Android Studio sees the changes immediately)

To pick up plugin edits in a fresh build:

```bash
npx expo prebuild --clean
npx expo run:android
```
