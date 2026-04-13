import { InteractionManager } from 'react-native';

/**
 * Defers work until after navigation transitions / animations so back navigation stays responsive.
 * Returns a cleanup that cancels the scheduled task when the screen blurs.
 */
export function runAfterNavigationTransition(fn) {
  const task = InteractionManager.runAfterInteractions(() => {
    fn();
  });
  return () => {
    if (task && typeof task.cancel === 'function') task.cancel();
  };
}
