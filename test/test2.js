#!/usr/bin/env node

process.argv = ['node', 'main.js', '--tests=tests.json', '--catalog=catalog.xml'];
var mxv = require('../main');
mxv.run().then(
  function(failures) {
    console.log("failures: " + failures);
  },
  function(error) {
    console.err("error: " + error);
  }
);
