# Google Sign-In Setup & Fixing DEVELOPER_ERROR

The **DEVELOPER_ERROR** from `@react-native-google-signin/google-signin` means there is a **configuration mismatch** between your app and Google Cloud Console (or Firebase). Fix it by aligning the following.

---

## 1. Run the config doctor (recommended)

From the **frontend** directory, with your app build available (APK on device or emulator, or built with EAS):

```bash
cd frontend
npx @react-native-google-signin/config-doctor
```

Follow the printed instructions. The doctor checks package name, SHA-1, and client IDs.

---

## 2. Required OAuth clients in Google Cloud

You need **at least two** OAuth 2.0 Client IDs in [Google Cloud Console → APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials):

| Type     | Purpose | Where it’s used |
|----------|---------|------------------|
| **Web**  | Required for the sign-in flow (ID token) | `app.json` → `extra.googleWebClientId` and `GoogleSignin.configure({ webClientId })` |
| **Android** | Identifies your Android app | Google Cloud only. Must have **package name** + **SHA-1** so the app is allowed to sign in. |
| **iOS**  | Identifies your iOS app | `app.json` → `extra.googleIosClientId` and plugin `iosUrlScheme`. |

- The **Web** client ID is what you pass as `webClientId` in the app. Do **not** use the Android client ID as `webClientId`.
- The **Android** client does not go in the app config; it must exist with the correct package name and SHA-1 so Google accepts sign-in from your APK.

---

## 3. Android: package name + SHA-1

Your app uses **package name** `com.farely.app` (from `app.json` → `expo.android.package`).

1. In Google Cloud Console, open your **Android** OAuth client (or create one).
2. Set **Package name** to: `com.farely.app`.
3. Add the **SHA-1** of the keystore that actually signs the build you’re testing:

   **Debug (local / Expo dev client):**
   ```bash
   keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android
   ```
   Copy the **SHA-1** line (e.g. `AB:CD:EF:12:...`) and add it to the Android OAuth client.

   **EAS / Expo build:**  
   In [Expo dashboard](https://expo.dev) → your project → Credentials (or build details), find the keystore used for the build and get its SHA-1, then add that SHA-1 to the same Android OAuth client.

4. Save. Wait a few minutes for Google to propagate changes.

If the SHA-1 or package name doesn’t match the build you’re running, you get **DEVELOPER_ERROR**.

---

## 4. iOS: bundle ID + URL scheme

Your app uses **bundle identifier** `com.farely.app` (from `app.json` → `expo.ios.bundleIdentifier`).

1. Create an **iOS** OAuth client in Google Cloud with **Bundle ID**: `com.farely.app`.
2. In `app.json`, the plugin uses the **reversed iOS client ID** as `iosUrlScheme` (e.g. `com.googleusercontent.apps.732209755307-...`). That value must come from this same iOS client.
3. `extra.googleIosClientId` should be the full iOS **Client ID** (e.g. `732209755307-....apps.googleusercontent.com`).

---

## 5. Verify values in your app

In **frontend/app.json** you have:

- `extra.googleWebClientId` → must be the **Web** OAuth client ID.
- `extra.googleIosClientId` → must be the **iOS** OAuth client ID.
- Plugin `iosUrlScheme` → must be the reversed iOS client ID (e.g. `com.googleusercontent.apps.XXXX-YYYY`).

`AuthContext` reads these and passes them to `GoogleSignin.configure()`. No Android client ID is set in the app (only Web + optional iOS); the Android client in Google Cloud is only for allowing your APK by package name + SHA-1.

---

## 6. Checklist

- [ ] **Web** OAuth client created; its Client ID is in `googleWebClientId` and in `GoogleSignin.configure({ webClientId })`.
- [ ] **Android** OAuth client created with package name `com.farely.app` and the **correct SHA-1** for the keystore that signs your build (debug or EAS).
- [ ] **iOS** OAuth client created with bundle ID `com.farely.app`; `googleIosClientId` and `iosUrlScheme` in app match this client.
- [ ] After changing credentials, wait a few minutes and try again; clear app data or reinstall if needed.

---

## 7. References

- [react-native-google-signin troubleshooting](https://react-native-google-signin.github.io/docs/troubleshooting) (DEVELOPER_ERROR section)
- [Config doctor](https://react-native-google-signin.github.io/docs/config-doctor)
- Backend: `backend/docs/CREDENTIALS_AND_ENV.md` (Google SSO env vars for token verification)
