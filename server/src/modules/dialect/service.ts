import { mockDialectInfo } from '../../mocks';

/** Mock-backed endpoint stub; Stage 1 loads and validates data/dialects/registry.json. */
export function listDialects() {
  return mockDialectInfo();
}
