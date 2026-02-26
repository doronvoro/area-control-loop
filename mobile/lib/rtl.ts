import { I18nManager } from 'react-native';

export function setupRTL() {
  if (!I18nManager.isRTL) {
    I18nManager.allowRTL(true);
    I18nManager.forceRTL(true);
    // Note: forceRTL requires an app restart to take effect on first launch
  }
}
