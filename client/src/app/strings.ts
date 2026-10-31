import type { Strings } from '@/lib/i18n';

const en = {
  dockLabel: 'Page',
  dockHome: 'Home',
  dockHow: 'How it works',
  openApp: 'Open app',
  notFoundTitle: 'Page not found',
  goHome: 'Go to home',
  errorTitle: 'Something went wrong',
  reload: 'Reload',
};

export const appStrings: Strings<typeof en> = {
  en,
  // TODO(review-native): dock strings are machine-written.
  hi: {
    dockLabel: 'पेज',
    dockHome: 'होम',
    dockHow: 'कैसे काम करता है',
    openApp: 'ऐप खोलें',
    notFoundTitle: 'पेज नहीं मिला',
    goHome: 'होम पर जाएं',
    errorTitle: 'कुछ गड़बड़ हो गई',
    reload: 'फिर से लोड करें',
  },
  // TODO(review-native): dock strings are machine-written.
  mr: {
    dockLabel: 'पान',
    dockHome: 'मुख्यपान',
    dockHow: 'कसे चालते',
    openApp: 'ॲप उघडा',
    notFoundTitle: 'पान सापडले नाही',
    goHome: 'मुख्य पानावर जा',
    errorTitle: 'काहीतरी चूक झाली',
    reload: 'पुन्हा लोड करा',
  },
  // TODO(review-native): dock strings are machine-written.
  ta: {
    dockLabel: 'பக்கம்',
    dockHome: 'முகப்பு',
    dockHow: 'செயல்முறை',
    openApp: 'செயலியைத் திற',
    notFoundTitle: 'பக்கம் கிடைக்கவில்லை',
    goHome: 'முகப்புக்குச் செல்',
    errorTitle: 'ஏதோ தவறு நடந்தது',
    reload: 'மீண்டும் ஏற்று',
  },
};
