import type { Strings } from '@/lib/i18n';

const en = {
  title: 'SMS & low data',
  subtitle: 'Every answer also comes as a short SMS, for keypad phones and weak networks.',
  lowBandwidth: 'Low bandwidth mode',
  lowBandwidthHint: 'Text first, no downloaded audio. Top answers are saved for offline use.',
  previewTitle: 'SMS preview',
  noAnswerYet: 'Ask a question first. Its SMS version will appear here.',
  smsCount: '{segments} SMS · {chars} characters',
  composeLabel: 'Turn any text into an SMS',
  composePlaceholder: 'Paste or type text here',
  draftCount: 'Now: {segments} SMS',
  compress: 'Make SMS',
  faqTitle: 'Saved answers (work offline)',
  faqUnavailable: 'Saved answers are not available yet. Connect once to download them.',
  loading: 'Loading…',
  error: 'Could not make the SMS. Please try again.',
};

export const smsStrings: Strings<typeof en> = {
  en,
  hi: {
    title: 'SMS और कम डेटा',
    subtitle: 'हर जवाब छोटे SMS में भी आता है, कीपैड फ़ोन और कमज़ोर नेटवर्क के लिए।',
    lowBandwidth: 'कम डेटा मोड',
    lowBandwidthHint: 'पहले टेक्स्ट, ऑडियो डाउनलोड नहीं। मुख्य जवाब ऑफ़लाइन के लिए सहेजे जाते हैं।',
    previewTitle: 'SMS झलक',
    noAnswerYet: 'पहले एक सवाल पूछें। उसका SMS रूप यहाँ दिखेगा।',
    smsCount: '{segments} SMS · {chars} अक्षर',
    composeLabel: 'किसी भी टेक्स्ट को SMS में बदलें',
    composePlaceholder: 'यहाँ टेक्स्ट लिखें या चिपकाएं',
    draftCount: 'अभी: {segments} SMS',
    compress: 'SMS बनाएं',
    faqTitle: 'सहेजे गए जवाब (ऑफ़लाइन भी)',
    faqUnavailable:
      'सहेजे गए जवाब अभी उपलब्ध नहीं हैं। उन्हें डाउनलोड करने के लिए एक बार इंटरनेट से जुड़ें।',
    loading: 'लोड हो रहा है…',
    error: 'SMS नहीं बन सका। कृपया फिर से कोशिश करें।',
  },
  mr: {
    title: 'SMS आणि कमी डेटा',
    subtitle: 'प्रत्येक उत्तर छोट्या SMS मध्येही येते, कीपॅड फोन आणि कमकुवत नेटवर्कसाठी.',
    lowBandwidth: 'कमी डेटा मोड',
    lowBandwidthHint: 'आधी मजकूर, ऑडिओ डाउनलोड नाही. मुख्य उत्तरे ऑफलाइन वापरासाठी जतन होतात.',
    previewTitle: 'SMS पूर्वावलोकन',
    noAnswerYet: 'आधी एक प्रश्न विचारा. त्याचे SMS रूप येथे दिसेल.',
    smsCount: '{segments} SMS · {chars} अक्षरे',
    composeLabel: 'कोणताही मजकूर SMS मध्ये बदला',
    composePlaceholder: 'येथे मजकूर लिहा किंवा पेस्ट करा',
    draftCount: 'आता: {segments} SMS',
    compress: 'SMS तयार करा',
    faqTitle: 'जतन केलेली उत्तरे (ऑफलाइनही)',
    faqUnavailable:
      'जतन केलेली उत्तरे अद्याप उपलब्ध नाहीत. ती डाउनलोड करण्यासाठी एकदा इंटरनेटशी जोडा.',
    loading: 'लोड होत आहे…',
    error: 'SMS तयार होऊ शकला नाही. कृपया पुन्हा प्रयत्न करा.',
  },
  ta: {
    title: 'SMS & குறைந்த டேட்டா',
    subtitle:
      'ஒவ்வொரு பதிலும் சிறிய SMS ஆகவும் வரும்: கீபேட் போன்களுக்கும் பலவீனமான நெட்வொர்க்குக்கும்.',
    lowBandwidth: 'குறைந்த டேட்டா பயன்முறை',
    lowBandwidthHint:
      'முதலில் உரை, ஒலி பதிவிறக்கம் இல்லை. முக்கிய பதில்கள் ஆஃப்லைனுக்காகச் சேமிக்கப்படும்.',
    previewTitle: 'SMS முன்னோட்டம்',
    noAnswerYet: 'முதலில் ஒரு கேள்வி கேளுங்கள். அதன் SMS வடிவம் இங்கே தோன்றும்.',
    smsCount: '{segments} SMS · {chars} எழுத்துகள்',
    composeLabel: 'எந்த உரையையும் SMS ஆக மாற்றுங்கள்',
    composePlaceholder: 'இங்கே உரையை உள்ளிடுங்கள் அல்லது ஒட்டுங்கள்',
    draftCount: 'இப்போது: {segments} SMS',
    compress: 'SMS உருவாக்கு',
    faqTitle: 'சேமித்த பதில்கள் (ஆஃப்லைனிலும்)',
    faqUnavailable:
      'சேமித்த பதில்கள் இன்னும் இல்லை. அவற்றைப் பதிவிறக்க ஒருமுறை இணையத்துடன் இணையுங்கள்.',
    loading: 'ஏற்றுகிறது…',
    error: 'SMS உருவாக்க முடியவில்லை. மீண்டும் முயற்சிக்கவும்.',
  },
};
