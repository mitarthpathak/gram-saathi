import type { LanguageCode } from '@gram-saathi/shared';
import { Flame, HeartPulse, House, PiggyBank, Shovel, Wheat, type LucideIcon } from 'lucide-react';

export interface SchemeShortcut {
  id: string;
  Icon: LucideIcon;
  /** Tailwind classes for the icon tile. */
  tone: string;
  name: Record<LanguageCode, string>;
  /** What it is for, in a word or two. */
  topic: Record<LanguageCode, string>;
  /** The question asked when the tile is tapped. */
  question: Record<LanguageCode, string>;
}

/** One-tap questions on the empty chat screen. Keep them answerable from data/schemes. */
export const SCHEME_SHORTCUTS: SchemeShortcut[] = [
  {
    id: 'pm-kisan',
    Icon: Wheat,
    tone: 'bg-leaf-100 text-leaf-600',
    name: { en: 'PM-KISAN', hi: 'पीएम-किसान', mr: 'पीएम-किसान', ta: 'பிஎம்-கிசான்' },
    topic: { en: 'Farmers', hi: 'किसान', mr: 'शेतकरी', ta: 'விவசாயிகள்' },
    question: {
      en: 'How much money does PM-KISAN give?',
      hi: 'पीएम किसान में कितना पैसा मिलता है?',
      mr: 'पीएम किसानमध्ये किती पैसे मिळतात?',
      ta: 'பிஎம் கிசானில் எவ்வளவு பணம் கிடைக்கும்?',
    },
  },
  {
    id: 'ayushman-bharat-pmjay',
    Icon: HeartPulse,
    tone: 'bg-rose-100 text-rose-700',
    name: {
      en: 'Ayushman card',
      hi: 'आयुष्मान कार्ड',
      mr: 'आयुष्मान कार्ड',
      ta: 'ஆயுஷ்மான் அட்டை',
    },
    topic: { en: 'Health', hi: 'स्वास्थ्य', mr: 'आरोग्य', ta: 'சுகாதாரம்' },
    question: {
      en: 'How do I get an Ayushman card?',
      hi: 'आयुष्मान कार्ड कैसे बनवाएं?',
      mr: 'आयुष्मान कार्ड कसे काढायचे?',
      ta: 'ஆயுஷ்மான் அட்டை எப்படிப் பெறுவது?',
    },
  },
  {
    id: 'atal-pension-yojana',
    Icon: PiggyBank,
    tone: 'bg-marigold-100 text-marigold-700',
    name: { en: 'Atal Pension', hi: 'अटल पेंशन', mr: 'अटल पेन्शन', ta: 'அடல் ஓய்வூதியம்' },
    topic: { en: 'Pension', hi: 'पेंशन', mr: 'पेन्शन', ta: 'ஓய்வூதியம்' },
    question: {
      en: 'How much pension does Atal Pension Yojana give?',
      hi: 'अटल पेंशन योजना में कितनी पेंशन मिलती है?',
      mr: 'अटल पेन्शन योजनेत किती पेन्शन मिळते?',
      ta: 'அடல் ஓய்வூதியத் திட்டத்தில் எவ்வளவு ஓய்வூதியம் கிடைக்கும்?',
    },
  },
  {
    id: 'pm-ujjwala-yojana',
    Icon: Flame,
    tone: 'bg-orange-100 text-orange-700',
    name: { en: 'Ujjwala gas', hi: 'उज्ज्वला गैस', mr: 'उज्ज्वला गॅस', ta: 'உஜ்வாலா எரிவாயு' },
    topic: { en: 'Cooking gas', hi: 'रसोई गैस', mr: 'स्वयंपाक गॅस', ta: 'சமையல் எரிவாயு' },
    question: {
      en: 'Who can get a free gas connection under Ujjwala?',
      hi: 'उज्ज्वला योजना में मुफ़्त गैस कनेक्शन किसे मिलता है?',
      mr: 'उज्ज्वला योजनेत मोफत गॅस कनेक्शन कोणाला मिळते?',
      ta: 'உஜ்வாலா திட்டத்தில் இலவச எரிவாயு இணைப்பு யாருக்குக் கிடைக்கும்?',
    },
  },
  {
    id: 'pmay-gramin',
    Icon: House,
    tone: 'bg-sky-100 text-sky-700',
    name: { en: 'Housing (PMAY-G)', hi: 'आवास योजना', mr: 'आवास योजना', ta: 'வீட்டுத் திட்டம்' },
    topic: { en: 'Housing', hi: 'घर', mr: 'घर', ta: 'வீடு' },
    question: {
      en: 'How much money does PM Awas Yojana Gramin give to build a house?',
      hi: 'प्रधानमंत्री आवास योजना ग्रामीण में घर बनाने के लिए कितना पैसा मिलता है?',
      mr: 'प्रधानमंत्री आवास योजना ग्रामीणमध्ये घर बांधण्यासाठी किती पैसे मिळतात?',
      ta: 'பிரதமர் ஆவாஸ் யோஜனா கிராமீண் திட்டத்தில் வீடு கட்ட எவ்வளவு பணம் கிடைக்கும்?',
    },
  },
  {
    id: 'mgnrega',
    Icon: Shovel,
    tone: 'bg-violet-100 text-violet-700',
    name: { en: 'MGNREGA work', hi: 'मनरेगा काम', mr: 'मनरेगा काम', ta: '100 நாள் வேலை' },
    topic: { en: 'Work', hi: 'रोज़गार', mr: 'रोजगार', ta: 'வேலை' },
    question: {
      en: 'How many days of work does MGNREGA give?',
      hi: 'मनरेगा में कितने दिन का काम मिलता है?',
      mr: 'मनरेगामध्ये किती दिवसांचे काम मिळते?',
      ta: 'நூறு நாள் வேலைத் திட்டத்தில் எத்தனை நாள் வேலை கிடைக்கும்?',
    },
  },
];
