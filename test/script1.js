#!/usr/bin/env node

// Test programmatically running multiple suites.

// Note that the cwd has to be correct before the require.
process.chdir(__dirname);

var mxv = require('../main');   // main.js

return new mxv.TestSet()
  .newSuite({
    tests: 'misc-cases/tests.json',
    catalog: 'misc-cases/catalog.xml',
  })
  .newSuite({
    tests: 'xinclude/tests.json',
    catalog: 'xinclude/catalog.xml',
  })
  .run()
  .then(
    // Resolved means no serious errors, but the tests might have failures
    function(failures) {
      process.exit(failures);
    },
    // Rejected is worse
    function(error) {
      console.error(error);
      process.exit(1);
    }
  );

