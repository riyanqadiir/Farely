# Farely Aggregator Defense Readiness

## Architecture Statement

Farely is an aggregator platform. It estimates fares using route distance and provider coefficients, then redirects users to provider apps (Yango, inDrive, Careem, Bykea) for final booking and payment confirmation.

## Yango route handoff (documented)

Yango’s partner docs describe route redirects via **`https://yango.go.link/route`** with `start-lat`, `start-lon`, `end-lat`, `end-lon`, `ref`, plus technical params **`adj_t`**, **`adj_deeplink_js`**, and URL-encoded **`adj_fallback`** to the web order page (`gfrom` / `gto` as **longitude,latitude**). See [Generating links](https://yango.com/en_int/partner-program/documentation/#Generating_links).

Farely opens that URL with `Linking.openURL` (Android `ACTION_VIEW`). Final map state is controlled by Yango’s redirect handler.

Optional AppMetrica distribution URL is **off by default**; set `EXPO_PUBLIC_YANGO_APPMETRICA_REDIRECT=true` only if you have a valid integration.

## inDrive route handoff (best-effort)

Public URL-parameter docs for passenger ride deeplinks were not found. Farely uses an order informed by the installed Android app manifest (`sinet.startup.inDriver`): **`indrive://open/ride`** (with pickup/drop pairs) is tried before **`https://…/app?…`**, because the HTTPS entry often opens the app without applying unknown query parameters. Also tries **`geo:`**, bare **`indrive://open`**, and package launch. Final map prefill still depends on the inDrive app build.

To discover which URL inDrive actually handles, set **`EXPO_PUBLIC_DEBUG_PROVIDER_REDIRECT=true`** in `frontend/.env`, restart Metro (e.g. `npx expo start -c` or rerun `npx expo run:android`), and watch the Metro terminal for `[Farely:providerRedirect]` lines. `try` / `opened` lines print the **full** URI Farely passes to `Linking.openURL` (unlike truncated `ActivityTaskManager` logcat snippets).

**Example (Metro, inDrive):** after tapping **Open app**, you may see:

```text
[Farely:providerRedirect] inDrive candidates 14
[Farely:providerRedirect] inDrive try indrive://open/ride?pickup=31.5675517,74.41497&dropoff=31.5622136,74.4137129
[Farely:providerRedirect] inDrive opened indrive://open/ride?pickup=31.5675517,74.41497&dropoff=31.5622136,74.4137129
```

That shape is **`pickup` / `dropoff` as `latitude,longitude`** on `indrive://open/ride`. There is no separate “city rides” mode parameter in this successful handoff; prefill behavior still depends on the inDrive build.

On Android you can also run: `adb logcat | grep -iE 'indrive|VIEW|DeeplinkActivity|sinet.startup'` while opening links from Farely or from marketing emails inside the app.

## Bykea route handoff (best-effort)

No public passenger deeplink specification was found on [bykea.com](https://bykea.com/) or in common developer listings. Farely tries **`bykea://`** / **`bykeapk://`** paths with pickup/drop query patterns used by other regional ride apps, then **`geo:`**, **`android-app://com.bykea.pk`**, and an Android **`intent://…package=com.bykea.pk`** launcher. Use **`EXPO_PUBLIC_DEBUG_PROVIDER_REDIRECT=true`** to see which URL `Linking.openURL` accepts first. Final UI is controlled by the Bykea app.

## Demo Flow (5 minutes)

1. Login to Farely and open ride search.
2. Choose pickup and destination.
3. Tap **Compare estimates** to see Yango/inDrive/Careem/Bykea estimated fares.
4. Select one provider and tap **Open app**.
5. Show Yango handoff: first attempt is official `yango.go.link` route URL (then geo / app schemes if needed).
6. Open `admin-web/index.html` and show:
   - ride search logs
   - provider selection/redirect outcomes
   - support ticket queue

## Viva Answer (Short)

We initially validated product flow with mocked APIs. Based on feedback, we transitioned to a realistic aggregator model: transparent fare estimates in Farely, final booking in provider apps through deep linking. This aligns with industry comparison platforms and avoids unsupported direct provider integrations.

## Validation Checklist

- [ ] User sees estimate disclaimer in ride compare flow.
- [ ] Provider app opens (or fallback URL opens) from Farely.
- [ ] Yango: route opens via documented `yango.go.link` (pickup/drop coordinates in query + `adj_fallback`).
- [ ] Bykea: Metro debug shows which `bykea://` / fallback URL opened (best-effort; no public partner link spec).
- [ ] Search logs are stored in `RideSearchLog`.
- [ ] Selection redirects are stored in `ProviderSelectionLog`.
- [ ] Admin role can view `/admin/searches`, `/admin/provider-selections`, `/admin/support-tickets`.
- [ ] Support tickets can be created via `/support/tickets`.
