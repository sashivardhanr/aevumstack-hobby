import { describe, expect, it } from 'vitest';
import { composeProjectName } from '../../scripts/local-settings.mjs';

describe('local Compose project isolation', () => {
  it('preserves the established project name by default', () => {
    expect(composeProjectName(undefined)).toBe('aevumstack-local');
  });

  it('accepts a separate safe project name for isolated local data', () => {
    expect(composeProjectName('aevumstack-v1-final')).toBe('aevumstack-v1-final');
  });

  it('rejects names that are invalid or could alter Compose selection', () => {
    for (const value of ['', 'Aevum', '../other', 'space name', '-leading']) {
      expect(() => composeProjectName(value)).toThrow('lowercase Docker Compose project name');
    }
  });
});
