import { transformSync } from '@babel/core';
import plugin from './packages/babel/cjs/index.js';

const config = {
  paths: ['process.env.API_BASE_URL', 'process.env.APP_VERSION', '__DEV__']
};

console.log('Testing with config:', config);

// Test 1: process?.env.API_BASE_URL
console.log('\n=== Test 1: process?.env.API_BASE_URL ===');
const code1 = 'const a = process?.env.API_BASE_URL;';
console.log('Code:', code1);
try {
  transformSync(code1, {
    plugins: [[plugin, config]],
    parserOpts: { sourceType: 'module' },
  });
  console.log('❌ No error thrown - BUG!');
} catch (error) {
  console.log('✅ Error thrown:', error.message);
}

// Test 2: process.env?.API_BASE_URL
console.log('\n=== Test 2: process.env?.API_BASE_URL ===');
const code2 = 'const a = process.env?.API_BASE_URL;';
console.log('Code:', code2);
try {
  transformSync(code2, {
    plugins: [[plugin, config]],
    parserOpts: { sourceType: 'module' },
  });
  console.log('❌ No error thrown - BUG!');
} catch (error) {
  console.log('✅ Error thrown:', error.message);
}

// Test 3: process?.env
console.log('\n=== Test 3: process?.env ===');
const code3 = 'const a = process?.env;';
console.log('Code:', code3);
try {
  transformSync(code3, {
    plugins: [[plugin, { paths: ['process.env'] }]],
    parserOpts: { sourceType: 'module' },
  });
  console.log('❌ No error thrown - BUG!');
} catch (error) {
  console.log('✅ Error thrown:', error.message);
}

// Test 4: Direct access (should pass)
console.log('\n=== Test 4: process.env.API_BASE_URL (direct) ===');
const code4 = 'const a = process.env.API_BASE_URL;';
console.log('Code:', code4);
try {
  transformSync(code4, {
    plugins: [[plugin, config]],
    parserOpts: { sourceType: 'module' },
  });
  console.log('✅ No error - correct!');
} catch (error) {
  console.log('❌ Unexpected error:', error.message);
}
