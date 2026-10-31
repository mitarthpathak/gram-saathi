import type { Strings } from '@/lib/i18n';

const en = {
  holdToSpeak: 'Hold to speak',
  listening: 'Listening… release or tap to send',
  wait: 'Please wait…',
  listen: 'Listen',
  preparingAudio: 'Preparing audio…',
  speakFailed: 'Audio playback is unavailable on this device.',
  voiceApproximate: 'Voice in {language}; the dialect pronunciation is approximate',
  voiceNamedDialect: 'Dialect voice, experimental',
  micDenied: 'Microphone blocked. Allow it in the browser settings, or type your question.',
  micUnavailable: 'No microphone found. Please type your question instead.',
  micInsecure: 'The microphone needs a secure (https) page. Please type your question.',
  autoStopped: 'Sent after 30 seconds. Keep questions short.',
};

export const voiceStrings: Strings<typeof en> = {
  en,
  hi: {
    holdToSpeak: 'दबाकर बोलें',
    listening: 'सुन रहे हैं… छोड़ें या टैप करें',
    wait: 'कृपया रुकें…',
    listen: 'सुनें',
    preparingAudio: 'आवाज़ तैयार हो रही है…',
    speakFailed: 'इस फोन पर आवाज़ नहीं चल पाई।',
    voiceApproximate: 'आवाज़ {language} में, बोली का उच्चारण अनुमानित',
    voiceNamedDialect: 'बोली की आवाज़, प्रयोगात्मक',
    micDenied: 'माइक बंद है। ब्राउज़र सेटिंग में अनुमति दें, या अपना सवाल लिखें।',
    micUnavailable: 'माइक नहीं मिला। कृपया अपना सवाल लिखें।',
    micInsecure: 'माइक के लिए सुरक्षित (https) पेज चाहिए। कृपया अपना सवाल लिखें।',
    autoStopped: '30 सेकंड पर भेज दिया। सवाल छोटा रखें।',
  },
  mr: {
    holdToSpeak: 'दाबून बोला',
    listening: 'ऐकत आहोत… सोडा किंवा टॅप करा',
    wait: 'कृपया थांबा…',
    listen: 'ऐका',
    // TODO(review-native): new honesty labels; have a native Marathi speaker review them.
    preparingAudio: 'आवाज तयार होत आहे…',
    speakFailed: 'या फोनवर आवाज चालू शकत नाही.',
    voiceApproximate: '{language} आवाज, बोलीचा उच्चार अंदाजे',
    voiceNamedDialect: 'बोलीतील आवाज, प्रायोगिक',
    micDenied: 'माइक बंद आहे. ब्राउझर सेटिंगमध्ये परवानगी द्या, किंवा तुमचा प्रश्न लिहा.',
    micUnavailable: 'माइक सापडला नाही. कृपया तुमचा प्रश्न लिहा.',
    micInsecure: 'माइकसाठी सुरक्षित (https) पान लागते. कृपया तुमचा प्रश्न लिहा.',
    autoStopped: '30 सेकंदांनी पाठवले. प्रश्न छोटा ठेवा.',
  },
  ta: {
    holdToSpeak: 'அழுத்திப் பேசுங்கள்',
    listening: 'கேட்கிறோம்… விடுங்கள் அல்லது தட்டுங்கள்',
    wait: 'சற்றுக் காத்திருங்கள்…',
    listen: 'கேட்க',
    // TODO(review-native): new honesty labels; have a native Tamil speaker review them.
    preparingAudio: 'ஒலி தயாராகிறது…',
    speakFailed: 'இந்த சாதனத்தில் ஒலியை இயக்க முடியவில்லை.',
    voiceApproximate: '{language} குரல்; வட்டார உச்சரிப்பு தோராயமானது',
    voiceNamedDialect: 'வட்டார வழக்குக் குரல், சோதனை நிலை',
    micDenied:
      'மைக் தடுக்கப்பட்டுள்ளது. உலாவி அமைப்புகளில் அனுமதியுங்கள், அல்லது கேள்வியைத் தட்டச்சு செய்யுங்கள்.',
    micUnavailable: 'மைக் கிடைக்கவில்லை. கேள்வியைத் தட்டச்சு செய்யுங்கள்.',
    micInsecure: 'மைக்கிற்குப் பாதுகாப்பான (https) பக்கம் தேவை. கேள்வியைத் தட்டச்சு செய்யுங்கள்.',
    autoStopped: '30 வினாடிகளில் அனுப்பப்பட்டது. கேள்வியைச் சுருக்கமாக வையுங்கள்.',
  },
};
