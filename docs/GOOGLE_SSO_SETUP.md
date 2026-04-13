# Google Sign-In (SSO) — Android `DEVELOPER_ERROR`

The alert **`DEVELOPER_ERROR`** comes from `@react-native-google-signin/google-signin` **before** your app calls the Farely API. It means Google Play Services could not validate this Android app against your OAuth credentials.

Official troubleshooting: [react-native-google-signin troubleshooting](https://react-native-google-signin.github.io/docs/troubleshooting)

---

## 1. Confirm app identity (this repo)

| Setting | Value |
|--------|--------|
| Android package / `applicationId` | `com.farely.app` |
| Web client ID (Expo `extra.googleWebClientId`) | `732209755307-73gv7r389hrjmhhcprc0ib25ehabl235.apps.googleusercontent.com` |
| iOS client ID (Expo `extra.googleIosClientId`) | `732209755307-krgg4q36fnod5n3henpbr2qq65q1o8pt.apps.googleusercontent.com` |

`GoogleSignin.configure` uses the **Web** client ID as `webClientId`. The ID token’s `aud` claim is that **Web** client.

---

## 2. Fix Android `DEVELOPER_ERROR` (most common)

### 2.1 Get your **debug** SHA-1

This project signs debug builds with [`frontend/android/app/debug.keystore`](../frontend/android/app/debug.keystore).

**Example (this repo’s `frontend/android/app/debug.keystore` — verify locally with keytool):**  
`SHA1: 5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25`  
If your file differs, always use the output from **your** machine’s keytool.

```bash
keytool -list -v -keystore frontend/android/app/debug.keystore \
  -alias androiddebugkey -storepass android -keypass android
```

Copy the **SHA1** line (format `AA:BB:...`).

If that keystore is missing, use the default Android debug keystore:

```bash
keytool -list -v -keystore ~/.android/debug.keystore \
  -alias androiddebugkey -storepass android -keypass android
```

> **Important:** If you use **EAS Build**, **Android Studio “Generate signed bundle”**, or a **custom release keystore**, you must register **that** keystore’s SHA-1 (and SHA-256 if Google asks) as well. Each signing key = another fingerprint in Google Cloud.

### 2.2 Google Cloud Console

1. Open [Google Cloud Console](https://console.cloud.google.com/) → select the **same project** where the Web and iOS OAuth clients were created.
2. **APIs & Services** → **Credentials**.
3. **Create credentials** → **OAuth client ID** → Application type: **Android**.
4. **Package name:** `com.farely.app`
5. **SHA-1 certificate fingerprint:** paste from step 2.1.
6. Save.

You can add **multiple** Android OAuth clients (e.g. one for local debug keystore, one for Play App Signing).

### 2.3 Wait and rebuild

- Changes in Google Console can take **a few minutes** to propagate.
- Rebuild the native app: `cd frontend && npx expo run:android` (not only Metro refresh).

---

## 3. Backend token verification (after native sign-in works)

`POST /auth/google` verifies the ID token with audiences from env (see [`backend/controller/auth.controller.js`](../backend/controller/auth.controller.js)).

The Android ID token (when `webClientId` is the **Web** client) is usually issued for audience = **that Web client ID**.

Set in **`backend/.env`** (at least one; including all matching clients is safest):

```env
GOOGLE_WEB_CLIENT_ID=732209755307-73gv7r389hrjmhhcprc0ib25ehabl235.apps.googleusercontent.com
GOOGLE_IOS_CLIENT_ID=732209755307-krgg4q36fnod5n3henpbr2qq65q1o8pt.apps.googleusercontent.com
# Optional: Android OAuth *client id* string if you use it elsewhere; token aud is still often the Web client:
# GOOGLE_CLIENT_ID=...
```

If `hasGoogleAuth` is false (no env set), the API returns **503** — that is different from `DEVELOPER_ERROR`.

---

## 4. iOS (if you hit issues later)

- Use the iOS OAuth client; URL scheme in [`frontend/app.json`](../frontend/app.json) plugin `iosUrlScheme` must match the reversed iOS client id scheme.

---

## 5. Quick checklist

- [ ] Android OAuth client exists with package **`com.farely.app`** and SHA-1 for the **keystore you actually sign with**.
- [ ] Same Google Cloud project as the **Web** client used in `app.json` → `extra.googleWebClientId`.
- [ ] Rebuilt native app after Console changes.
- [ ] `backend/.env` includes **`GOOGLE_WEB_CLIENT_ID`** (same Web client id) so `/auth/google` can verify the token.

---

## 6. Android client + SHA-1 look correct — still failing?

### 6.1 OAuth consent screen — test users (most common after SHA-1 is right)

1. **APIs & Services** → **OAuth consent screen**.
2. If the app is in **Testing** (not in production / not verified for all users):
   - Open **Test users** and add the **exact Google account** you use on the device/emulator (e.g. `you@gmail.com`).
3. Save, wait a few minutes, try sign-in again.

Without this, Google can still reject sign-in even when the Android OAuth client and SHA-1 are correct.

### 6.2 Confirm two credentials in **Credentials**

You should see **both**:

1. **Web application** — its Client ID must match `extra.googleWebClientId` in [`frontend/app.json`](../frontend/app.json).
2. **Android** — package `com.farely.app` and your SHA-1.

The Android entry does **not** replace the Web client; the app still needs the **Web** client ID in `GoogleSignin.configure`.

### 6.3 Match the keystore Gradle actually uses

On the machine that runs `expo run:android`:

```bash
cd frontend/android
./gradlew :app:signingReport
```

Use the **SHA1** printed for the variant you install (usually `debug`). If it differs from `frontend/android/app/debug.keystore`, register **that** SHA-1 in Google Cloud too (or add another Android OAuth client).

### 6.4 SHA-256 (optional)

If the Console offers SHA-256 for the Android client, add it from the same `keytool -list -v` output.

### 6.5 Clean install + rebuild

1. Uninstall **Farely** from the emulator/device.
2. From `frontend`:

   ```bash
   npx expo prebuild --clean
   npx expo run:android
   ```

### 6.6 Expo plugin (this repo)

With `iosUrlScheme` set in [`frontend/app.json`](../frontend/app.json), the Google Sign-In config plugin only adds the **iOS** URL scheme. **Android** still depends on the **Android OAuth client + SHA-1** in Google Cloud (as above), not on `google-services.json` for this setup.
