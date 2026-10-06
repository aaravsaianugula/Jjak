import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';

/** Share text via the native sheet, the Web Share API, or the clipboard. Returns how it went. */
export async function shareText(text: string): Promise<'shared' | 'copied' | 'failed'> {
  try {
    if (Capacitor.isNativePlatform()) {
      await Share.share({ text, dialogTitle: 'Share your Jjak' });
      return 'shared';
    }
    if (navigator.share) {
      await navigator.share({ text });
      return 'shared';
    }
    await navigator.clipboard.writeText(text);
    return 'copied';
  } catch {
    try {
      await navigator.clipboard.writeText(text);
      return 'copied';
    } catch {
      return 'failed';
    }
  }
}
