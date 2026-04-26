import '@testing-library/jest-dom';
import Module from 'module';

// ---------------------------------------------------------------------------
// Teach Node's require() to resolve .jsx files (vmForks pool uses CJS require
// for dynamic imports inside test functions).
// ---------------------------------------------------------------------------
const _origResolveFilename = Module._resolveFilename.bind(Module);
Module._resolveFilename = function (request, parent, isMain, options) {
  try {
    return _origResolveFilename(request, parent, isMain, options);
  } catch (err) {
    if (err.code === 'MODULE_NOT_FOUND' && !request.endsWith('.jsx')) {
      try {
        return _origResolveFilename(request + '.jsx', parent, isMain, options);
      } catch (_) {
        // fall through to original error
      }
    }
    throw err;
  }
};

// Register .jsx so require() can load and transform JSX files.
// Uses sucrase for synchronous JSX+ESM→CJS transformation.
if (typeof require !== 'undefined' && require.extensions) {
  require.extensions['.jsx'] = (mod, filename) => {
    // eslint-disable-next-line no-undef
    const fs = require('fs');
    const source = fs.readFileSync(filename, 'utf8');
    let compiled = source;
    try {
      const { transform } = require('sucrase');
      compiled = transform(source, {
        transforms: ['jsx', 'imports'],
        jsxRuntime: 'classic',
        production: false,
      }).code;
    } catch (_) {
      // sucrase unavailable — fall back, likely fails for JSX syntax
    }
    mod._compile(compiled, filename);
  };
}

// ---------------------------------------------------------------------------
// Polyfill localStorage for jsdom environments
// ---------------------------------------------------------------------------
if (typeof localStorage === 'undefined' || typeof localStorage.getItem !== 'function') {
  const store = {};
  const localStorageMock = {
    getItem: (key) => store[key] ?? null,
    setItem: (key, value) => { store[key] = String(value); },
    removeItem: (key) => { delete store[key]; },
    clear: () => { Object.keys(store).forEach((k) => delete store[k]); },
    get length() { return Object.keys(store).length; },
    key: (index) => Object.keys(store)[index] ?? null,
  };
  Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true });
}
