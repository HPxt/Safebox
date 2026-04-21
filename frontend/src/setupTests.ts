// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

// Polyfill Web Crypto API and encoding APIs for jsdom (CRA Jest runs in jsdom 16
// which lacks crypto.subtle, TextEncoder and TextDecoder).
// Node 18+ ships these as first-class globals; expose them for test compatibility.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const nodeCrypto = require('node:crypto') as typeof import('node:crypto')
// eslint-disable-next-line @typescript-eslint/no-var-requires
const nodeUtil = require('node:util') as typeof import('node:util')

if (!globalThis.crypto || !globalThis.crypto.subtle) {
  Object.defineProperty(globalThis, 'crypto', {
    value: nodeCrypto.webcrypto,
    writable: false,
    configurable: true,
  })
}

if (typeof globalThis.TextEncoder === 'undefined') {
  Object.defineProperty(globalThis, 'TextEncoder', {
    value: nodeUtil.TextEncoder,
    writable: false,
    configurable: true,
  })
}

if (typeof globalThis.TextDecoder === 'undefined') {
  Object.defineProperty(globalThis, 'TextDecoder', {
    value: nodeUtil.TextDecoder,
    writable: false,
    configurable: true,
  })
}
