#!/usr/bin/env node

var mxv = require('./main');   // main.js

mxv.run()
.then(
  function(failures) {
    console.log('Run completed with ' + failures + ' failures');
    process.exit(failures);
  },
  function(errors) {
    console.log('Error found, ' + errors);
    process.exit(1);
  }
);
