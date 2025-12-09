const { transformSync } = require('@swc/core');
const { realpathSync } = require('fs');
const { resolve } = require('path');

// 解析插件路径
const symlinkedPath = resolve(__dirname, 'e2e-tests/node_modules/@shined/swc-plugin-enforce-direct-access');
console.log('Symlinked path:', symlinkedPath);

try {
  const realPath = realpathSync(symlinkedPath);
  console.log('Real path:', realPath);

  const PLUGIN_PATH = resolve(realPath, 'swc_plugin_enforce_direct_access.wasm');
  console.log('Plugin WASM path:', PLUGIN_PATH);

  const fs = require('fs');
  console.log('WASM file exists:', fs.existsSync(PLUGIN_PATH));

  // 测试简单配置
  const code = `const x = process.env.API_KEY;`;
  console.log('\nTest 1: Simple code with config');
  console.log('Code:', code);
  console.log('Config:', { paths: ['process.env'] });

  try {
    const result = transformSync(code, {
      jsc: {
        parser: {
          syntax: 'ecmascript',
        },
        target: 'es2020',
        experimental: {
          plugins: [[PLUGIN_PATH, { paths: ['process.env'] }]],
        },
      },
      module: {
        type: 'es6',
      },
    });
    console.log('✅ Success');
    console.log('Output:', result.code);
  } catch (error) {
    console.log('❌ Error:', error.message);
  }

  // 测试空配置
  console.log('\nTest 2: Simple code with empty config');
  console.log('Config:', { paths: [] });

  try {
    const result = transformSync(code, {
      jsc: {
        parser: {
          syntax: 'ecmascript',
        },
        target: 'es2020',
        experimental: {
          plugins: [[PLUGIN_PATH, { paths: [] }]],
        },
      },
      module: {
        type: 'es6',
      },
    });
    console.log('✅ Success');
    console.log('Output:', result.code);
  } catch (error) {
    console.log('❌ Error:', error.message);
  }

} catch (error) {
  console.error('Failed to resolve plugin path:', error.message);
}
