const appJson = require("./app.json");

function iosSchemeFromClientId(clientId) {
  if (!clientId || typeof clientId !== "string") return "";
  return `com.googleusercontent.apps.${clientId.split(".apps.googleusercontent.com")[0]}`;
}

module.exports = ({ config }) => {
  const base = appJson.expo || {};

  const googleWebClientId =
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || base.extra?.googleWebClientId || "";
  const googleIosClientId =
    process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || base.extra?.googleIosClientId || "";
  const googleMapsApiKey =
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || base.extra?.googleMapsApiKey || "";
  const stripePublishableKey =
    process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || base.extra?.stripePublishableKey || "";
  const googleIosUrlScheme =
    process.env.EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME || iosSchemeFromClientId(googleIosClientId);

  const plugins = (base.plugins || []).map((plugin) => {
    if (Array.isArray(plugin) && plugin[0] === "@react-native-google-signin/google-signin") {
      return [
        "@react-native-google-signin/google-signin",
        {
          ...(plugin[1] || {}),
          iosUrlScheme: googleIosUrlScheme,
        },
      ];
    }
    return plugin;
  });

  return {
    ...base,
    ...config,
    plugins,
    android: {
      ...(base.android || {}),
      config: {
        ...((base.android && base.android.config) || {}),
        googleMaps: {
          ...((((base.android || {}).config || {}).googleMaps) || {}),
          apiKey: googleMapsApiKey,
        },
      },
    },
    extra: {
      ...(base.extra || {}),
      googleWebClientId,
      googleIosClientId,
      googleMapsApiKey,
      stripePublishableKey,
    },
  };
};
