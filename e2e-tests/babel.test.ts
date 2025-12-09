import { describe, it, expect } from 'vitest';
import { transformSync } from '@babel/core';
import enforceDirectAccessPlugin from '@shined/babel-plugin-enforce-direct-access';
import { testCases } from './test-cases';

describe('Babel Plugin E2E Tests', () => {
  testCases.forEach((testCase) => {
    it(testCase.description, () => {
      const transform = () =>
        transformSync(testCase.code, {
          plugins: [[enforceDirectAccessPlugin, testCase.config]],
          parserOpts: {
            sourceType: 'module',
          },
        });

      if (testCase.shouldError) {
        expect(transform).toThrow();
        if (testCase.errorPattern) {
          try {
            transform();
          } catch (error) {
            expect((error as Error).message).toMatch(testCase.errorPattern);
          }
        }
      } else {
        expect(transform).not.toThrow();
      }
    });
  });
});
