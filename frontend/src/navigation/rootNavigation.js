import { createNavigationContainerRef } from '@react-navigation/native';

/** Single ref attached to NavigationContainer in App.js — use for menu / global navigation. */
export const navigationRef = createNavigationContainerRef();

export function navigate(name, params) {
  if (navigationRef.isReady()) {
    navigationRef.navigate(name, params);
  }
}
