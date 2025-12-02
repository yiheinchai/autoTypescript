/**
 * Test setup file - makes the instrumentation runtime available
 */

// This file will be required before tests run
// AutoTypeScript will inject the instrumentation runtime here
global.__AUTOTYPESCRIPT__ = global.__AUTOTYPESCRIPT__ || {
  recordCall: function (funcName, args, paramNames) {
    // Placeholder - will be replaced by AutoTypeScript instrumentation
    console.log(`[AutoTypeScript] Recording call to ${funcName}:`, paramNames);
  },
};
