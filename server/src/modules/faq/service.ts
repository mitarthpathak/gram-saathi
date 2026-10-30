import type { FaqItem, LanguageCode } from '@gram-saathi/shared';
import { isMocked } from '../../config/env';
import { NotImplementedError } from '../../lib/httpError';
import { mockTopFaq } from '../../mocks';

/** The most asked questions with short answers. Clients cache this for offline use. */
export async function getTopFaqs(language: LanguageCode): Promise<FaqItem[]> {
  if (isMocked('faq')) return mockTopFaq(language);
  // TODO(step-2): curated top questions per language (or generated once from data/schemes with
  //   Gemini and saved). Keep the payload small: low-bandwidth clients download all of it.
  throw new NotImplementedError('faq.getTopFaqs');
}
