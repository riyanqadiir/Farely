const { withAndroidManifest, createRunOncePlugin } = require("expo/config-plugins");

const PROVIDER_SCHEMES = ["yango", "yandexyango", "bykea", "bykeapk", "geo"];
const PROVIDER_PACKAGES = ["com.yandex.yango", "com.bykea.pk"];

function viewIntentForScheme(scheme) {
  return {
    action: [{ $: { "android:name": "android.intent.action.VIEW" } }],
    category: [{ $: { "android:name": "android.intent.category.BROWSABLE" } }],
    data: [{ $: { "android:scheme": scheme } }],
  };
}

function ensureQueriesBlock(manifest) {
  if (!Array.isArray(manifest.queries) || manifest.queries.length === 0) {
    manifest.queries = [{ intent: [], package: [] }];
  }
  const block = manifest.queries[0];
  if (!Array.isArray(block.intent)) block.intent = [];
  if (!Array.isArray(block.package)) block.package = [];
  return block;
}

function intentHasScheme(intent, scheme) {
  const data = Array.isArray(intent?.data) ? intent.data : [];
  const action = Array.isArray(intent?.action) ? intent.action : [];
  const isView = action.some(
    (entry) => entry?.$?.["android:name"] === "android.intent.action.VIEW"
  );
  return isView && data.some((entry) => entry?.$?.["android:scheme"] === scheme);
}

function mergeQueries(manifest) {
  const block = ensureQueriesBlock(manifest);

  for (const scheme of PROVIDER_SCHEMES) {
    if (!block.intent.some((entry) => intentHasScheme(entry, scheme))) {
      block.intent.push(viewIntentForScheme(scheme));
    }
  }

  for (const packageName of PROVIDER_PACKAGES) {
    if (!block.package.some((entry) => entry?.$?.["android:name"] === packageName)) {
      block.package.push({ $: { "android:name": packageName } });
    }
  }

  return manifest;
}

const withAndroidProviderQueries = (config) =>
  withAndroidManifest(config, (modConfig) => {
    modConfig.modResults.manifest = mergeQueries(modConfig.modResults.manifest);
    return modConfig;
  });

module.exports = createRunOncePlugin(
  withAndroidProviderQueries,
  "with-android-provider-queries",
  "1.0.0"
);
