import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { save } from './storage';

const native = Capacitor.isNativePlatform();

const vib = (ms: number | number[]) => {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* unsupported */
  }
};

export const haptic = {
  light() {
    if (!save.settings.haptics) return;
    if (native) void Haptics.impact({ style: ImpactStyle.Light });
    else vib(8);
  },
  medium() {
    if (!save.settings.haptics) return;
    if (native) void Haptics.impact({ style: ImpactStyle.Medium });
    else vib(16);
  },
  warn() {
    if (!save.settings.haptics) return;
    if (native) void Haptics.notification({ type: NotificationType.Warning });
    else vib([10, 40, 10]);
  },
  success() {
    if (!save.settings.haptics) return;
    if (native) void Haptics.notification({ type: NotificationType.Success });
    else vib([12, 60, 24]);
  },
};
