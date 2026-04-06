import { registerRootComponent } from 'expo';

// Some navigation internals rely on WeakRef; provide a minimal fallback
// for runtimes that do not expose it yet.
if (typeof globalThis.WeakRef !== 'function') {
  globalThis.WeakRef = class WeakRefPolyfill {
    constructor(value) {
      this._value = value;
    }
    deref() {
      return this._value;
    }
  };
}

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
