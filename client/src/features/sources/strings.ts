import type { Strings } from '@/lib/i18n';

const en = {
  title: 'Sources',
  showMore: 'Show more',
  showLess: 'Show less',
};

export const sourceStrings: Strings<typeof en> = {
  en,
  hi: { title: 'स्रोत', showMore: 'और देखें', showLess: 'कम देखें' },
  mr: { title: 'स्रोत', showMore: 'अधिक पहा', showLess: 'कमी पहा' },
  ta: { title: 'ஆதாரங்கள்', showMore: 'மேலும் காட்டு', showLess: 'குறைவாகக் காட்டு' },
};
