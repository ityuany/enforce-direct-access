import { describe, it, expect } from 'vitest';
import { transformSync } from '@babel/core';
import plugin from '../index';

function transform(code: string, options?: any) {
  return transformSync(code, {
    plugins: [[plugin, options]],
    parserOpts: {
      sourceType: 'module',
    },
  });
}

describe('enforce-direct-access plugin', () => {
  describe('配置处理', () => {
    it('没有配置时不报错', () => {
      const code = `const x = process?.env.API_KEY;`;
      expect(() => transform(code)).not.toThrow();
    });

    it('paths 为空数组时不报错', () => {
      const code = `const x = process?.env.API_KEY;`;
      expect(() => transform(code, { paths: [] })).not.toThrow();
    });
  });

  describe('Pattern 1: 可选链检测', () => {
    it('检测 process?.env 的可选链', () => {
      const code = `const x = process?.env.API_KEY;`;
      expect(() =>
        transform(code, { paths: ['process.env'] })
      ).toThrow(/Optional chaining with 'process\.env' is unsafe/);
    });

    it('检测 process.env?.API_KEY 的可选链', () => {
      const code = `const x = process.env?.API_KEY;`;
      expect(() =>
        transform(code, { paths: ['process.env'] })
      ).toThrow(/Optional chaining with 'process\.env' is unsafe/);
    });

    it('检测计算属性的可选链', () => {
      const code = `const x = process?.['env'].API_KEY;`;
      expect(() =>
        transform(code, { paths: ['process.env'] })
      ).toThrow(/Optional chaining with 'process\.env' is unsafe/);
    });

    it('不匹配配置路径时不报错', () => {
      const code = `const x = process?.other.value;`;
      expect(() =>
        transform(code, { paths: ['process.env'] })
      ).not.toThrow();
    });

    it('直接访问不报错', () => {
      const code = `const x = process.env.API_KEY;`;
      expect(() =>
        transform(code, { paths: ['process.env'] })
      ).not.toThrow();
    });
  });

  describe('Pattern 3: 纯解构检测', () => {
    it('检测解构 process.env 本身', () => {
      const code = `const { env } = process;`;
      expect(() =>
        transform(code, { paths: ['process.env'] })
      ).toThrow(/Destructuring 'process\.env' is unsafe/);
    });

    it('检测 let 声明的解构', () => {
      const code = `let { env } = process;`;
      expect(() =>
        transform(code, { paths: ['process.env'] })
      ).toThrow(/Destructuring 'process\.env' is unsafe/);
    });

    it('检测 var 声明的解构', () => {
      const code = `var { env } = process;`;
      expect(() =>
        transform(code, { paths: ['process.env'] })
      ).toThrow(/Destructuring 'process\.env' is unsafe/);
    });

    it('从 process.env 读取属性不报错', () => {
      const code = `const { API_KEY } = process.env;`;
      expect(() =>
        transform(code, { paths: ['process.env'] })
      ).not.toThrow();
    });

    it('从 process.env 读取多个属性不报错', () => {
      const code = `const { API_KEY, PORT } = process.env;`;
      expect(() =>
        transform(code, { paths: ['process.env'] })
      ).not.toThrow();
    });

    it('配置 process.env.host 时检测解构 host', () => {
      const code = `const { host } = process.env;`;
      expect(() =>
        transform(code, { paths: ['process.env.host'] })
      ).toThrow(/Destructuring 'process\.env\.host' is unsafe/);
    });

    it('配置 process.env.host 时解构其他属性不报错', () => {
      const code = `const { name } = process.env;`;
      expect(() =>
        transform(code, { paths: ['process.env.host'] })
      ).not.toThrow();
    });
  });

  describe('Pattern 2: 解构 + 可选链', () => {
    it('检测解构 + 可选链', () => {
      const code = `const { API_KEY } = process?.env;`;
      expect(() =>
        transform(code, { paths: ['process.env'] })
      ).toThrow(/Destructuring with optional chaining on 'process\.env' is unsafe/);
    });

    it('检测 init 为可选链且匹配配置', () => {
      const code = `const { env } = process?.something;`;
      expect(() =>
        transform(code, { paths: ['process.something'] })
      ).toThrow(/Destructuring with optional chaining on 'process\.something' is unsafe/);
    });
  });

  describe('多个配置路径', () => {
    it('检测多个配置路径', () => {
      const code1 = `const x = process?.env.API_KEY;`;
      expect(() =>
        transform(code1, { paths: ['process.env', 'import.meta.env'] })
      ).toThrow(/Optional chaining with 'process\.env' is unsafe/);

      const code2 = `const y = import.meta?.env.MODE;`;
      expect(() =>
        transform(code2, { paths: ['process.env', 'import.meta.env'] })
      ).toThrow(/Optional chaining with 'import\.meta\.env' is unsafe/);
    });
  });

  describe('计算属性', () => {
    it('支持计算属性语法', () => {
      const code = `const x = process['env']?.API_KEY;`;
      expect(() =>
        transform(code, { paths: ['process.env'] })
      ).toThrow(/Optional chaining with 'process\.env' is unsafe/);
    });

    it('解构支持计算属性语法', () => {
      const code = `const { env } = process;`;
      expect(() =>
        transform(code, { paths: ['process.env'] })
      ).toThrow(/Destructuring 'process\.env' is unsafe/);
    });
  });

  describe('作用域检查', () => {
    it('局部变量不应该报错', () => {
      const code = `
        const process = { env: { API_KEY: 'test' } };
        const x = process?.env.API_KEY;
      `;
      expect(() =>
        transform(code, { paths: ['process.env'] })
      ).not.toThrow();
    });

    it('函数参数不应该报错', () => {
      const code = `
        function test(process) {
          const x = process?.env.API_KEY;
        }
      `;
      expect(() =>
        transform(code, { paths: ['process.env'] })
      ).not.toThrow();
    });

    it('块级作用域变量不应该报错', () => {
      const code = `
        {
          const process = { env: {} };
          const { env } = process;
        }
      `;
      expect(() =>
        transform(code, { paths: ['process.env'] })
      ).not.toThrow();
    });

    it('全局变量应该报错', () => {
      const code = `const x = process?.env.API_KEY;`;
      expect(() =>
        transform(code, { paths: ['process.env'] })
      ).toThrow(/Optional chaining with 'process\.env' is unsafe/);
    });

    it('import.meta 应该检查（即使没有作用域绑定）', () => {
      const code = `const x = import.meta?.env.MODE;`;
      expect(() =>
        transform(code, { paths: ['import.meta.env'] })
      ).toThrow(/Optional chaining with 'import\.meta\.env' is unsafe/);
    });
  });

  describe('import.meta.env 完整支持', () => {
    it('检测 import.meta?.env 的可选链', () => {
      const code = `const x = import.meta?.env.MODE;`;
      expect(() =>
        transform(code, { paths: ['import.meta.env'] })
      ).toThrow(/Optional chaining with 'import\.meta\.env' is unsafe/);
    });

    it('检测 import.meta.env?.MODE 的可选链', () => {
      const code = `const x = import.meta.env?.MODE;`;
      expect(() =>
        transform(code, { paths: ['import.meta.env'] })
      ).toThrow(/Optional chaining with 'import\.meta\.env' is unsafe/);
    });

    it('直接访问 import.meta.env 不报错', () => {
      const code = `const x = import.meta.env.MODE;`;
      expect(() =>
        transform(code, { paths: ['import.meta.env'] })
      ).not.toThrow();
    });

    it('检测解构 import.meta.env', () => {
      const code = `const { MODE } = import.meta.env;`;
      expect(() =>
        transform(code, { paths: ['import.meta.env'] })
      ).not.toThrow();
    });

    it('检测解构 import.meta 的 env 属性', () => {
      const code = `const { env } = import.meta;`;
      expect(() =>
        transform(code, { paths: ['import.meta.env'] })
      ).toThrow(/Destructuring 'import\.meta\.env' is unsafe/);
    });

    it('检测解构 + 可选链 import.meta?.env', () => {
      const code = `const { MODE } = import.meta?.env;`;
      expect(() =>
        transform(code, { paths: ['import.meta.env'] })
      ).toThrow(/Destructuring with optional chaining on 'import\.meta\.env' is unsafe/);
    });
  });
});
