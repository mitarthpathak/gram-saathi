import type { Strings } from '@/lib/i18n';

const en = {
  label: 'Language',
  auto: 'Auto detect',
};

export const languageStrings: Strings<typeof en> = {
  en,
  hi: { label: 'भाषा', auto: 'अपने आप पहचानें' },
  mr: { label: 'भाषा', auto: 'आपोआप ओळखा' },
  ta: { label: 'மொழி', auto: 'தானாகக் கண்டறி' },
};
