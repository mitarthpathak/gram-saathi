import type { Strings } from '@/lib/i18n';

const en = {
  heroLine1: 'Government',
  heroLine2: 'schemes, explained',
  heroLine3Before: 'in your own',
  heroWord: 'language',
  heroLine3After: '.',
  heroSub: 'Speak a question. Get a short answer from official documents.',
  holdToSpeak: 'Hold to speak',
  seeHow: 'See how it works',
  languagesLabel: 'Languages',
  homeLink: 'Gram Saathi, home',
};

export const landingStrings: Strings<typeof en> = {
  en,
  // TODO(review-native): all landing copy is machine-written.
  hi: {
    heroLine1: 'सरकारी योजनाएं,',
    heroLine2: 'समझिए आराम से,',
    heroLine3Before: 'अपनी',
    heroWord: 'भाषा',
    heroLine3After: ' में।',
    heroSub: 'सवाल बोलिए। आधिकारिक दस्तावेज़ों से छोटा जवाब पाइए।',
    holdToSpeak: 'दबाकर बोलें',
    seeHow: 'देखें कैसे काम करता है',
    languagesLabel: 'भाषाएं',
    homeLink: 'ग्राम साथी, होम',
  },
  // TODO(review-native): all landing copy is machine-written.
  mr: {
    heroLine1: 'सरकारी योजना,',
    heroLine2: 'समजून घ्या सहज,',
    heroLine3Before: 'तुमच्या',
    heroWord: 'भाषेत',
    heroLine3After: '.',
    heroSub: 'प्रश्न बोला. अधिकृत कागदपत्रांतून छोटे उत्तर मिळवा.',
    holdToSpeak: 'दाबून बोला',
    seeHow: 'हे कसे चालते ते पहा',
    languagesLabel: 'भाषा',
    homeLink: 'ग्राम साथी, मुख्यपान',
  },
  // TODO(review-native): all landing copy is machine-written.
  ta: {
    heroLine1: 'அரசுத் திட்டங்கள்,',
    heroLine2: 'எளிய விளக்கம்,',
    heroLine3Before: 'உங்கள்',
    heroWord: 'மொழியில்',
    heroLine3After: '.',
    heroSub: 'கேள்வியைப் பேசுங்கள். அதிகாரப்பூர்வ ஆவணங்களிலிருந்து சுருக்கமான பதில் பெறுங்கள்.',
    holdToSpeak: 'அழுத்திப் பேசுங்கள்',
    seeHow: 'எப்படி வேலை செய்கிறது',
    languagesLabel: 'மொழிகள்',
    homeLink: 'கிராம் சாத்தி, முகப்பு',
  },
};
