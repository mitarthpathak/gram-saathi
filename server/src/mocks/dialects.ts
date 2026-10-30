import type {
  DialectInfo,
  DialectOption,
  DialectResult,
  QueryResponse,
} from '@gram-saathi/shared';

const DIALECTS: DialectInfo[] = [
  { id: 'marwari', name: 'Marwari', nativeName: 'मारवाड़ी', parentLanguage: 'hi', states: ['Rajasthan'], testStatus: 'experimental' },
  { id: 'dhundhari', name: 'Dhundhari/Jaipuri', nativeName: 'ढूंढाड़ी/जयपुरी', parentLanguage: 'hi', states: ['Rajasthan'], testStatus: 'experimental' },
  { id: 'shekhawati', name: 'Shekhawati', nativeName: 'शेखावाटी', parentLanguage: 'hi', states: ['Rajasthan'], testStatus: 'experimental' },
  { id: 'bagri', name: 'Bagri', nativeName: 'बागड़ी', parentLanguage: 'hi', states: ['Rajasthan', 'Haryana'], testStatus: 'experimental' },
  { id: 'mewari', name: 'Mewari', nativeName: 'मेवाड़ी', parentLanguage: 'hi', states: ['Rajasthan'], testStatus: 'experimental' },
  { id: 'mewati', name: 'Mewati', nativeName: 'मेवाती', parentLanguage: 'hi', states: ['Rajasthan', 'Haryana'], testStatus: 'experimental' },
  { id: 'harauti', name: 'Harauti', nativeName: 'हाड़ौती', parentLanguage: 'hi', states: ['Rajasthan'], testStatus: 'experimental' },
  { id: 'malvi', name: 'Malvi', nativeName: 'मालवी', parentLanguage: 'hi', states: ['Rajasthan', 'Madhya Pradesh'], testStatus: 'experimental' },
  { id: 'wagdi', name: 'Wagdi', nativeName: 'वागड़ी', parentLanguage: 'hi', states: ['Rajasthan', 'Gujarat'], testStatus: 'experimental' },
  { id: 'braj', name: 'Braj', nativeName: 'ब्रज', parentLanguage: 'hi', states: ['Uttar Pradesh', 'Rajasthan', 'Madhya Pradesh'], testStatus: 'experimental' },
  { id: 'haryanvi', name: 'Haryanvi', nativeName: 'हरियाणवी', parentLanguage: 'hi', states: ['Haryana'], testStatus: 'experimental' },
  { id: 'bhojpuri', name: 'Bhojpuri', nativeName: 'भोजपुरी', parentLanguage: 'hi', states: ['Uttar Pradesh', 'Bihar'], testStatus: 'experimental' },
  { id: 'awadhi', name: 'Awadhi', nativeName: 'अवधी', parentLanguage: 'hi', states: ['Uttar Pradesh'], testStatus: 'experimental' },
  { id: 'bundeli', name: 'Bundeli', nativeName: 'बुंदेली', parentLanguage: 'hi', states: ['Uttar Pradesh', 'Madhya Pradesh'], testStatus: 'experimental' },
];

/** Registry-shaped mock options for the contract stub. */
export function mockDialectInfo(): DialectInfo[] {
  return DIALECTS.map((item) => ({ ...item, states: [...item.states] }));
}

let responseTurn = 0;

/** Mock wire shapes only; these rotating outcomes make no accuracy claim. */
export function mockDialectFields(dialectHint?: string): Pick<
  QueryResponse,
  'dialect' | 'dialectCandidates'
> {
  if (dialectHint) {
    const option = DIALECTS.find(({ id }) => id === dialectHint);
    return {
      dialect: option ? { ...toOption(option), confidence: 'high' } : null,
      dialectCandidates: [],
    };
  }

  const turn = responseTurn++ % 3;
  if (turn === 0) {
    return {
      dialect: { ...toOption(DIALECTS[0]), confidence: 'high' },
      dialectCandidates: [],
    };
  }
  if (turn === 1) {
    return {
      dialect: { ...toOption(DIALECTS[9]), confidence: 'medium' },
      dialectCandidates: [toOption(DIALECTS[9]), toOption(DIALECTS[0]), toOption(DIALECTS[5])],
    };
  }
  return {
    dialect: null,
    dialectCandidates: [toOption(DIALECTS[8]), toOption(DIALECTS[4])],
  };
}

function toOption(item: DialectOption): DialectOption {
  return { id: item.id, name: item.name, nativeName: item.nativeName };
}

export type MockDialectResult = DialectResult;
