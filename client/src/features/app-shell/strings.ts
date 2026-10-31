import type { Strings } from '@/lib/i18n';

const en = {
  appLabel: 'Gram Saathi app',
  closeApp: 'Close app',
  navLabel: 'App screens',
  tagline: 'Your scheme helper',
  navAsk: 'Ask',
  navEligibility: 'My schemes',
  navSms: 'SMS',
  demoData: 'Demo data',
  offline: 'Offline',
  lowData: 'Low data',
};

export const appShellStrings: Strings<typeof en> = {
  en,
  // TODO(review-native): appLabel, closeApp, navLabel are machine-written.
  hi: {
    appLabel: 'ग्राम साथी ऐप',
    closeApp: 'ऐप बंद करें',
    navLabel: 'ऐप के पेज',
    tagline: 'योजनाओं का साथी',
    navAsk: 'पूछें',
    navEligibility: 'मेरी योजनाएं',
    navSms: 'SMS',
    demoData: 'डेमो डेटा',
    offline: 'ऑफ़लाइन',
    lowData: 'कम डेटा',
  },
  // TODO(review-native): appLabel, closeApp, navLabel are machine-written.
  mr: {
    appLabel: 'ग्राम साथी ॲप',
    closeApp: 'ॲप बंद करा',
    navLabel: 'ॲपची पाने',
    tagline: 'योजनांचा साथी',
    navAsk: 'विचारा',
    navEligibility: 'माझ्या योजना',
    navSms: 'SMS',
    demoData: 'डेमो डेटा',
    offline: 'ऑफलाइन',
    lowData: 'कमी डेटा',
  },
  // TODO(review-native): appLabel, closeApp, navLabel are machine-written.
  ta: {
    appLabel: 'கிராம் சாத்தி செயலி',
    closeApp: 'செயலியை மூடு',
    navLabel: 'செயலிப் பக்கங்கள்',
    tagline: 'திட்டங்களின் துணை',
    navAsk: 'கேள்',
    navEligibility: 'என் திட்டங்கள்',
    navSms: 'SMS',
    demoData: 'டெமோ தரவு',
    offline: 'ஆஃப்லைன்',
    lowData: 'குறைந்த டேட்டா',
  },
};
