import { isMocked } from '../../config/env';
import { mockDialectInfo } from '../../mocks';
import type { DialectInfo } from '@gram-saathi/shared';
import { getDialectRegistry, toDialectInfo } from './registry';

/** Lists selectable dialects from the registry, or its mock-backed public copy. */
export function listDialects(): DialectInfo[] {
  if (isMocked('dialect')) return mockDialectInfo();
  return getDialectRegistry().map(toDialectInfo);
}
