/**
 * Main entry point for the sample project
 */

const utils = require("./utils");
const api = require("./api");

module.exports = {
  ...utils,
  ...api,
};
