#!/usr/bin/env node

process.argv = ['node', 'main.js', '--tests=tests.json', '--catalog=has-next-catalog.xml'];
var taskRunner = require('../taskrunner');
taskRunner.run().then(
  function(failures) {
    console.log("failures: " + failures);
  },
  function(error) {
    console.err("error: " + error);
  }
);
