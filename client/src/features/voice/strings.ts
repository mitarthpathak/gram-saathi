import type { Strings } from '@/lib/i18n';

const en = {
  holdToSpeak: 'Hold to speak',
  listening: 'Listening… release or tap to send',
  wait: 'Please wait…',
  listen: 'Listen',
};

export const voiceStrings: Strings<typeof en> = {
  en,
  hi: {
    holdToSpeak: 'दबाकर बोलें',
    listening: 'सुन रहे हैं… छोड़ें या टैप करें',
    wait: 'कृपया रुकें…',
    listen: 'सुनें',
  },
  mr: {
    holdToSpeak: 'दाबून बोला',
    listening: 'ऐकत आहोत… सोडा किंवा टॅप करा',
    wait: 'कृपया थांबा…',
    listen: 'ऐका',
  },
  ta: {
    holdToSpeak: 'அழுத்திப் பேசுங்கள்',
    listening: 'கேட்கிறோம்… விடுங்கள் அல்லது தட்டுங்கள்',
    wait: 'சற்றுக் காத்திருங்கள்…',
    listen: 'கேட்க',
  },
};
