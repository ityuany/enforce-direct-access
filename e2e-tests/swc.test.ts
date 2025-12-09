import { describe, it, expect } from 'vitest';
import { transformSync } from '@swc/core';
import { testCases } from './test-cases';
import { realpathSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 使用 workspace 协议引用 SWC 插件
// pnpm 使用符号链接，需要解析真实路径
const symlinkedPath = resolve(__dirname, 'node_modules/@shined/swc-plugin-enforce-direct-access');
const realPath = realpathSync(symlinkedPath);
const PLUGIN_PATH = resolve(realPath, 'swc_plugin_enforce_direct_access.wasm');

describe('SWC Plugin E2E Tests', () => {
  testCases.forEach((testCase) => {
    it(testCase.description, () => {
      const transform = () =>
        transformSync(testCase.code, {
          jsc: {
            parser: {
              syntax: 'ecmascript',
            },
            target: 'es2020',
            experimental: {
              plugins: [[PLUGIN_PATH, testCase.config]],
            },
          },
          module: {
            type: 'es6',
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
