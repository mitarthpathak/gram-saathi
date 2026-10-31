import type { Strings } from '@/lib/i18n';

const en = {
  // Story
  storyEyebrow: 'How it works',
  storyTitle: 'From a spoken question to an answer you can trust',
  step1Title: 'You ask by voice',
  step1Text: 'Hold the button and speak in Hindi, Marathi, Tamil or English. No typing, no forms.',
  step2Title: 'Official documents are searched',
  step2Text:
    'Gram Saathi looks only in official scheme documents, and keeps the part it used as the source.',
  step3Title: 'A short answer, read aloud and sent as SMS',
  step3Text: 'Simple words, spoken by the phone, plus an SMS copy that fits even a basic phone.',
  step4Title: 'Not in the documents? It says so.',
  step4Text:
    'No guessing. It tells you the documents do not cover it, and where to ask: your nearest CSC or gram panchayat.',
  docTitle: 'PM-KISAN guidelines',
  docBenefits: 'Benefits',
  docEligibility: 'Eligibility',
  docApply: 'How to apply',
  sourceAttached: 'Source attached',
  fitsInSms: 'Fits in {count} SMS',
  cscTitle: 'Ask at your nearest CSC or gram panchayat',
  cscText: 'They can confirm what the documents do not cover.',
  stepLabel: 'Step {n}',

  // Eligibility
  eligEyebrow: 'Eligibility',
  eligTitle: 'Eligibility in a minute',
  eligText: 'Three quick questions, checked against clear rules. Same answers, same result.',
  q1: 'Does your family own farmland?',
  q2: 'Are you between 18 and 40 years old?',
  q3: 'Does anyone in your family pay income tax?',
  yes: 'Yes',
  no: 'No',
  swipeHint: 'Swipe right for yes, left for no, or tap a button.',
  questionOf: 'Question {current} of {total}',
  resultTitle: 'Your quick check',
  mayQualify: 'You may qualify',
  probablyNot: 'Probably not',
  checkAtCsc: 'Check your name at a CSC',
  eligNote:
    'A quick check, not a decision. The app asks a few more questions, and the official office always has the final word.',
  tryAgain: 'Start again',
  openChecker: 'Open the full check',

  // Fraud shield
  fraudEyebrow: 'Fraud shield',
  fraudTitle: 'No scheme ever asks for money or an OTP.',
  fraudText:
    'Every answer carries this reminder. If anyone asks you to pay, or to share an OTP, for a scheme: it is a fraud.',
  scam1: 'Send ₹500 today to register for PM-KISAN.',
  scam2: 'Share the OTP you just got to activate your Ayushman card.',
  unknownSender: 'Unknown number',
  stamp: 'Fraud',
  withEveryAnswer: 'Shown with every answer',

  // Languages
  langEyebrow: 'Four languages',
  langTitle: 'Same answer, in your own language',
  langText: 'Tap a language to see the sample answer, then listen to it.',
  langPick: 'Language of the sample answer',
  sampleQuestion: 'Sample question',

  // Basic phones
  basicEyebrow: 'Low data',
  basicTitle: 'Works on basic phones',
  basicText:
    'Every answer also comes as an SMS. Low-data mode skips audio downloads, keeps top answers for offline use, and calms this page down too. Try it:',
  dataLabel: 'Data for one answer',
  dataWithVoice: 'with voice audio',
  dataTextOnly: 'text only',
  dataNote:
    'Estimate for the sample answer: its text, plus voice audio at 24 kbps. Real sizes vary.',

  // Final call to action
  ctaTitle: 'Ask your first question',
  ctaText: 'Free. No sign-up. Hindi, Marathi, Tamil or English.',
  openApp: 'Open app',

  // Footer
  footerTagline: 'A voice-first helper for government schemes.',
  github: 'Source code on GitHub',
  credits: 'Made with care for rural India. Open source.',
  demoTitle: 'Demo data',
  disclaimer:
    'Gram Saathi is an independent project, not a government service. Answers in this demo come from sample scheme documents: always confirm at your nearest CSC or gram panchayat.',
};

export const chapterStrings: Strings<typeof en> = {
  en,
  // TODO(review-native): all chapter copy below is machine-written.
  hi: {
    storyEyebrow: 'यह कैसे काम करता है',
    storyTitle: 'बोले गए सवाल से भरोसेमंद जवाब तक',
    step1Title: 'आप बोलकर पूछते हैं',
    step1Text: 'बटन दबाकर हिन्दी, मराठी, तमिल या अंग्रेज़ी में बोलें। न टाइप करना, न फ़ॉर्म भरना।',
    step2Title: 'आधिकारिक दस्तावेज़ खोजे जाते हैं',
    step2Text:
      'ग्राम साथी सिर्फ़ आधिकारिक योजना दस्तावेज़ों में देखता है, और जिस हिस्से से जवाब लिया, उसे स्रोत के रूप में दिखाता है।',
    step3Title: 'छोटा जवाब, पढ़कर सुनाया और SMS में भेजा',
    step3Text: 'आसान शब्द, फ़ोन की आवाज़ में, और एक SMS कॉपी जो साधारण फ़ोन पर भी आ जाए।',
    step4Title: 'दस्तावेज़ों में नहीं? यह साफ़ बताता है।',
    step4Text:
      'कोई अंदाज़ा नहीं। यह बताता है कि दस्तावेज़ों में यह जानकारी नहीं है, और कहाँ पूछें: नज़दीकी CSC या ग्राम पंचायत।',
    docTitle: 'पीएम-किसान दिशानिर्देश',
    docBenefits: 'लाभ',
    docEligibility: 'पात्रता',
    docApply: 'आवेदन कैसे करें',
    sourceAttached: 'स्रोत जुड़ा',
    fitsInSms: '{count} SMS में पूरा',
    cscTitle: 'नज़दीकी CSC या ग्राम पंचायत में पूछें',
    cscText: 'जो दस्तावेज़ों में नहीं है, वे पक्का बता सकते हैं।',
    stepLabel: 'कदम {n}',

    eligEyebrow: 'पात्रता',
    eligTitle: 'एक मिनट में पात्रता',
    eligText: 'तीन छोटे सवाल, साफ़ नियमों से जाँचे गए। वही जवाब, वही नतीजा।',
    q1: 'क्या आपके परिवार के पास खेती की ज़मीन है?',
    q2: 'क्या आपकी उम्र 18 से 40 साल के बीच है?',
    q3: 'क्या आपके परिवार में कोई आयकर देता है?',
    yes: 'हाँ',
    no: 'नहीं',
    swipeHint: 'हाँ के लिए दाएँ, नहीं के लिए बाएँ खिसकाएँ, या बटन दबाएँ।',
    questionOf: 'सवाल {current} / {total}',
    resultTitle: 'आपकी छोटी जाँच',
    mayQualify: 'आप पात्र हो सकते हैं',
    probablyNot: 'शायद नहीं',
    checkAtCsc: 'CSC पर अपना नाम जाँचें',
    eligNote:
      'यह छोटी जाँच है, फ़ैसला नहीं। ऐप कुछ और सवाल पूछता है, और आख़िरी फ़ैसला हमेशा सरकारी दफ़्तर का होता है।',
    tryAgain: 'फिर से शुरू करें',
    openChecker: 'पूरी जाँच खोलें',

    fraudEyebrow: 'धोखाधड़ी से बचाव',
    fraudTitle: 'कोई भी योजना पैसे या OTP नहीं माँगती।',
    fraudText:
      'हर जवाब के साथ यह याद दिलाया जाता है। अगर कोई योजना के नाम पर पैसे या OTP माँगे, तो वह धोखा है।',
    scam1: 'पीएम-किसान में पंजीकरण के लिए आज ही ₹500 भेजें।',
    scam2: 'आयुष्मान कार्ड चालू करने के लिए अभी आया OTP बताएँ।',
    unknownSender: 'अनजान नंबर',
    stamp: 'धोखा',
    withEveryAnswer: 'हर जवाब के साथ दिखता है',

    langEyebrow: 'चार भाषाएँ',
    langTitle: 'वही जवाब, आपकी अपनी भाषा में',
    langText: 'कोई भाषा चुनें, नमूना जवाब देखें, फिर सुनें।',
    langPick: 'नमूना जवाब की भाषा',
    sampleQuestion: 'नमूना सवाल',

    basicEyebrow: 'कम डेटा',
    basicTitle: 'साधारण फ़ोन पर भी चलता है',
    basicText:
      'हर जवाब SMS में भी आता है। कम डेटा मोड ऑडियो डाउनलोड नहीं करता, मुख्य जवाब ऑफ़लाइन के लिए सहेजता है, और इस पेज को भी शांत कर देता है। आज़माएँ:',
    dataLabel: 'एक जवाब का डेटा',
    dataWithVoice: 'आवाज़ के साथ',
    dataTextOnly: 'सिर्फ़ टेक्स्ट',
    dataNote: 'नमूना जवाब का अनुमान: उसका टेक्स्ट, और 24 kbps पर आवाज़। असली आकार अलग हो सकता है।',

    ctaTitle: 'अपना पहला सवाल पूछें',
    ctaText: 'मुफ़्त। कोई साइन-अप नहीं। हिन्दी, मराठी, तमिल या अंग्रेज़ी।',
    openApp: 'ऐप खोलें',

    footerTagline: 'सरकारी योजनाओं के लिए बोलकर चलने वाला साथी।',
    github: 'GitHub पर सोर्स कोड',
    credits: 'ग्रामीण भारत के लिए प्यार से बनाया गया। ओपन सोर्स।',
    demoTitle: 'डेमो डेटा',
    disclaimer:
      'ग्राम साथी एक स्वतंत्र प्रोजेक्ट है, सरकारी सेवा नहीं। इस डेमो के जवाब नमूना योजना दस्तावेज़ों से हैं: हमेशा नज़दीकी CSC या ग्राम पंचायत से पक्का करें।',
  },
  // TODO(review-native): all chapter copy below is machine-written.
  mr: {
    storyEyebrow: 'हे कसे चालते',
    storyTitle: 'बोललेल्या प्रश्नापासून विश्वासार्ह उत्तरापर्यंत',
    step1Title: 'तुम्ही बोलून विचारता',
    step1Text: 'बटण दाबून हिंदी, मराठी, तमिळ किंवा इंग्रजीत बोला. टायपिंग नाही, फॉर्म नाही.',
    step2Title: 'अधिकृत कागदपत्रे शोधली जातात',
    step2Text:
      'ग्राम साथी फक्त अधिकृत योजना कागदपत्रांमध्ये पाहतो, आणि वापरलेला भाग स्रोत म्हणून दाखवतो.',
    step3Title: 'छोटे उत्तर, वाचून दाखवलेले आणि SMS मध्ये',
    step3Text: 'सोपे शब्द, फोनच्या आवाजात, आणि साध्या फोनवरही येईल अशी SMS प्रत.',
    step4Title: 'कागदपत्रांत नाही? ते स्पष्ट सांगते.',
    step4Text:
      'अंदाज नाही. कागदपत्रांत ही माहिती नाही हे सांगते, आणि कुठे विचारायचे: जवळचे CSC किंवा ग्रामपंचायत.',
    docTitle: 'पीएम-किसान मार्गदर्शक सूचना',
    docBenefits: 'लाभ',
    docEligibility: 'पात्रता',
    docApply: 'अर्ज कसा करावा',
    sourceAttached: 'स्रोत जोडला',
    fitsInSms: '{count} SMS मध्ये पूर्ण',
    cscTitle: 'जवळच्या CSC किंवा ग्रामपंचायतीत विचारा',
    cscText: 'कागदपत्रांत नसलेली माहिती ते निश्चित सांगू शकतात.',
    stepLabel: 'पायरी {n}',

    eligEyebrow: 'पात्रता',
    eligTitle: 'एका मिनिटात पात्रता',
    eligText: 'तीन छोटे प्रश्न, स्पष्ट नियमांनुसार तपासलेले. तीच उत्तरे, तोच निकाल.',
    q1: 'तुमच्या कुटुंबाकडे शेतजमीन आहे का?',
    q2: 'तुमचे वय 18 ते 40 वर्षांच्या दरम्यान आहे का?',
    q3: 'तुमच्या कुटुंबात कोणी आयकर भरतो का?',
    yes: 'हो',
    no: 'नाही',
    swipeHint: 'होसाठी उजवीकडे, नाहीसाठी डावीकडे सरकवा, किंवा बटण दाबा.',
    questionOf: 'प्रश्न {current} / {total}',
    resultTitle: 'तुमची छोटी तपासणी',
    mayQualify: 'तुम्ही पात्र असू शकता',
    probablyNot: 'बहुधा नाही',
    checkAtCsc: 'CSC मध्ये तुमचे नाव तपासा',
    eligNote:
      'ही छोटी तपासणी आहे, निर्णय नाही. ॲप आणखी काही प्रश्न विचारते, आणि अंतिम निर्णय नेहमी सरकारी कार्यालयाचा असतो.',
    tryAgain: 'पुन्हा सुरू करा',
    openChecker: 'पूर्ण तपासणी उघडा',

    fraudEyebrow: 'फसवणुकीपासून संरक्षण',
    fraudTitle: 'कोणतीही योजना पैसे किंवा OTP मागत नाही.',
    fraudText:
      'प्रत्येक उत्तरासोबत ही आठवण दिली जाते. योजनेच्या नावाने कोणी पैसे किंवा OTP मागितला, तर ती फसवणूक आहे.',
    scam1: 'पीएम-किसान नोंदणीसाठी आजच ₹500 पाठवा.',
    scam2: 'आयुष्मान कार्ड सुरू करण्यासाठी आत्ता आलेला OTP सांगा.',
    unknownSender: 'अनोळखी नंबर',
    stamp: 'फसवणूक',
    withEveryAnswer: 'प्रत्येक उत्तरासोबत दिसते',

    langEyebrow: 'चार भाषा',
    langTitle: 'तेच उत्तर, तुमच्या भाषेत',
    langText: 'भाषा निवडा, नमुना उत्तर पहा, मग ऐका.',
    langPick: 'नमुना उत्तराची भाषा',
    sampleQuestion: 'नमुना प्रश्न',

    basicEyebrow: 'कमी डेटा',
    basicTitle: 'साध्या फोनवरही चालते',
    basicText:
      'प्रत्येक उत्तर SMS मध्येही येते. कमी डेटा मोड ऑडिओ डाउनलोड करत नाही, मुख्य उत्तरे ऑफलाइनसाठी जतन करतो, आणि हे पानही शांत करतो. करून पहा:',
    dataLabel: 'एका उत्तराचा डेटा',
    dataWithVoice: 'आवाजासह',
    dataTextOnly: 'फक्त मजकूर',
    dataNote:
      'नमुना उत्तराचा अंदाज: त्याचा मजकूर, आणि 24 kbps वर आवाज. प्रत्यक्ष आकार वेगळा असू शकतो.',

    ctaTitle: 'तुमचा पहिला प्रश्न विचारा',
    ctaText: 'मोफत. साइन-अप नाही. हिंदी, मराठी, तमिळ किंवा इंग्रजी.',
    openApp: 'ॲप उघडा',

    footerTagline: 'सरकारी योजनांसाठी बोलून वापरता येणारा साथी.',
    github: 'GitHub वर सोर्स कोड',
    credits: 'ग्रामीण भारतासाठी प्रेमाने बनवलेले. ओपन सोर्स.',
    demoTitle: 'डेमो डेटा',
    disclaimer:
      'ग्राम साथी हा स्वतंत्र प्रकल्प आहे, सरकारी सेवा नाही. या डेमोतील उत्तरे नमुना योजना कागदपत्रांतून आहेत: नेहमी जवळच्या CSC किंवा ग्रामपंचायतीत खात्री करा.',
  },
  // TODO(review-native): all chapter copy below is machine-written.
  ta: {
    storyEyebrow: 'இது எப்படி வேலை செய்கிறது',
    storyTitle: 'பேசிய கேள்வியிலிருந்து நம்பகமான பதில் வரை',
    step1Title: 'நீங்கள் குரலில் கேட்கிறீர்கள்',
    step1Text:
      'பொத்தானை அழுத்தி இந்தி, மராத்தி, தமிழ் அல்லது ஆங்கிலத்தில் பேசுங்கள். தட்டச்சு இல்லை, படிவம் இல்லை.',
    step2Title: 'அதிகாரப்பூர்வ ஆவணங்கள் தேடப்படுகின்றன',
    step2Text:
      'கிராம் சாத்தி அதிகாரப்பூர்வ திட்ட ஆவணங்களில் மட்டுமே பார்க்கிறது; பயன்படுத்திய பகுதியை ஆதாரமாகக் காட்டுகிறது.',
    step3Title: 'சுருக்கமான பதில், வாசித்துக் காட்டி SMS ஆகவும்',
    step3Text: 'எளிய சொற்கள், தொலைபேசியின் குரலில்; சாதாரண போனிலும் வரும் SMS நகல்.',
    step4Title: 'ஆவணங்களில் இல்லையா? அதைத் தெளிவாகச் சொல்லும்.',
    step4Text:
      'ஊகம் இல்லை. ஆவணங்களில் இந்தத் தகவல் இல்லை என்றும், எங்கே கேட்கலாம் என்றும் சொல்லும்: அருகிலுள்ள CSC அல்லது கிராம பஞ்சாயத்து.',
    docTitle: 'பிஎம்-கிசான் வழிகாட்டுதல்கள்',
    docBenefits: 'நன்மைகள்',
    docEligibility: 'தகுதி',
    docApply: 'விண்ணப்பிப்பது எப்படி',
    sourceAttached: 'ஆதாரம் இணைக்கப்பட்டது',
    fitsInSms: '{count} SMS-ல் அடங்கும்',
    cscTitle: 'அருகிலுள்ள CSC அல்லது கிராம பஞ்சாயத்தில் கேளுங்கள்',
    cscText: 'ஆவணங்களில் இல்லாததை அவர்கள் உறுதிப்படுத்துவார்கள்.',
    stepLabel: 'படி {n}',

    eligEyebrow: 'தகுதி',
    eligTitle: 'ஒரே நிமிடத்தில் தகுதி',
    eligText: 'மூன்று சிறிய கேள்விகள், தெளிவான விதிகளுடன். அதே பதில்கள், அதே முடிவு.',
    q1: 'உங்கள் குடும்பத்துக்கு விவசாய நிலம் உள்ளதா?',
    q2: 'உங்கள் வயது 18 முதல் 40 வரை உள்ளதா?',
    q3: 'உங்கள் குடும்பத்தில் யாராவது வருமான வரி செலுத்துகிறார்களா?',
    yes: 'ஆம்',
    no: 'இல்லை',
    swipeHint:
      'ஆம் என்றால் வலப்புறம், இல்லை என்றால் இடப்புறம் தள்ளுங்கள், அல்லது பொத்தானைத் தட்டுங்கள்.',
    questionOf: 'கேள்வி {current} / {total}',
    resultTitle: 'உங்கள் சிறு சோதனை',
    mayQualify: 'நீங்கள் தகுதி பெறலாம்',
    probablyNot: 'பெரும்பாலும் இல்லை',
    checkAtCsc: 'CSC-ல் உங்கள் பெயரைச் சரிபாருங்கள்',
    eligNote:
      'இது சிறு சோதனை மட்டுமே, முடிவு அல்ல. செயலி இன்னும் சில கேள்விகள் கேட்கும்; இறுதி முடிவு எப்போதும் அரசு அலுவலகத்துடையது.',
    tryAgain: 'மீண்டும் தொடங்கு',
    openChecker: 'முழு சோதனையைத் திற',

    fraudEyebrow: 'மோசடிக் கவசம்',
    fraudTitle: 'எந்தத் திட்டமும் பணமோ OTP-யோ கேட்பதில்லை.',
    fraudText:
      'ஒவ்வொரு பதிலுடனும் இந்த நினைவூட்டல் வரும். திட்டத்தின் பெயரில் யாராவது பணமோ OTP-யோ கேட்டால், அது மோசடி.',
    scam1: 'பிஎம்-கிசான் பதிவுக்கு இன்றே ₹500 அனுப்புங்கள்.',
    scam2: 'ஆயுஷ்மான் அட்டையைச் செயல்படுத்த இப்போது வந்த OTP-ஐச் சொல்லுங்கள்.',
    unknownSender: 'தெரியாத எண்',
    stamp: 'மோசடி',
    withEveryAnswer: 'ஒவ்வொரு பதிலுடனும் தெரியும்',

    langEyebrow: 'நான்கு மொழிகள்',
    langTitle: 'அதே பதில், உங்கள் சொந்த மொழியில்',
    langText: 'ஒரு மொழியைத் தேர்ந்து மாதிரிப் பதிலைப் பாருங்கள், பின் கேளுங்கள்.',
    langPick: 'மாதிரிப் பதிலின் மொழி',
    sampleQuestion: 'மாதிரிக் கேள்வி',

    basicEyebrow: 'குறைந்த டேட்டா',
    basicTitle: 'சாதாரண போன்களிலும் இயங்கும்',
    basicText:
      'ஒவ்வொரு பதிலும் SMS ஆகவும் வரும். குறைந்த டேட்டா பயன்முறை ஒலியைப் பதிவிறக்காது, முக்கிய பதில்களை ஆஃப்லைனுக்குச் சேமிக்கும், இந்தப் பக்கத்தையும் அமைதியாக்கும். முயன்று பாருங்கள்:',
    dataLabel: 'ஒரு பதிலுக்கான டேட்டா',
    dataWithVoice: 'குரலுடன்',
    dataTextOnly: 'உரை மட்டும்',
    dataNote:
      'மாதிரிப் பதிலுக்கான மதிப்பீடு: அதன் உரை, மற்றும் 24 kbps குரல். உண்மையான அளவு மாறலாம்.',

    ctaTitle: 'உங்கள் முதல் கேள்வியைக் கேளுங்கள்',
    ctaText: 'இலவசம். பதிவு தேவையில்லை. இந்தி, மராத்தி, தமிழ் அல்லது ஆங்கிலம்.',
    openApp: 'செயலியைத் திற',

    footerTagline: 'அரசுத் திட்டங்களுக்கான குரல் வழித் துணை.',
    github: 'GitHub-ல் மூலக் குறியீடு',
    credits: 'கிராமப்புற இந்தியாவுக்காக அன்புடன் உருவாக்கப்பட்டது. திறந்த மூலம்.',
    demoTitle: 'டெமோ தரவு',
    disclaimer:
      'கிராம் சாத்தி ஒரு சுயாதீனத் திட்டம், அரசு சேவை அல்ல. இந்த டெமோவின் பதில்கள் மாதிரித் திட்ட ஆவணங்களிலிருந்து வருகின்றன: எப்போதும் அருகிலுள்ள CSC அல்லது கிராம பஞ்சாயத்தில் உறுதிப்படுத்துங்கள்.',
  },
};
