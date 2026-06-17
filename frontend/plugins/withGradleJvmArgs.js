const { withGradleProperties } = require("expo/config-plugins");

const JVM_ARGS =
  "-Xmx4096m -XX:MaxMetaspaceSize=1024m -XX:+HeapDumpOnOutOfMemoryError -Dfile.encoding=UTF-8";

function setGradleProperty(modResults, key, value) {
  const index = modResults.findIndex(
    (item) => item.type === "property" && item.key === key
  );
  if (index >= 0) {
    modResults[index] = { type: "property", key, value };
  } else {
    modResults.push({ type: "property", key, value });
  }
}

/** Raise Gradle heap/metaspace for release builds (lint, KSP, expo-updates). */
module.exports = function withGradleJvmArgs(config) {
  return withGradleProperties(config, (exportedConfig) => {
    setGradleProperty(
      exportedConfig.modResults,
      "org.gradle.jvmargs",
      JVM_ARGS
    );
    return exportedConfig;
  });
};
