#!/usr/bin/env node

var Mocha = require('mocha'),
    fs = require('fs'),
    path = require('path'),
    getopt = require('node-getopt');

opt = getopt.create([
  [ '', 'tests=ARG',
    'JSON file that defines the tests; default is test/tests.json.' ],
  [ '', 'catalog=ARG',
    'OASIS catalog file; default is catalog.xml. Use the value NONE to ' +
    'specify no catalog.' ],
  [ '', 'reporter=ARG',
    'Specify the test reporter for mocha to use; default is "nyan".' ],
  [ 'h', 'help', 'Display help' ],
])
.bindHelp()
.parseSystem();

var options = opt.options,
    testsFile = options.tests || 'test/tests.json',
    catalogFile = options.catalog ?
      (options.catalog == 'NONE' ? null : options.catalog) : 'catalog.xml',
    reporter = options.reporter || 'nyan';

// The test and catalog files will be relative to some base directory.
// If we're invoked via a `require`, then this will be the directory
// of the requiring module. Otherwise, use current working directory.
var requireMain = require.main.filename;

var baseDir = __filename == requireMain ?
  process.cwd() : path.dirname(requireMain);

//console.log("===============================================");
//console.log("__filename: ", __filename);
//console.log("requireMain: ", requireMain);
//console.log("baseDir: ", baseDir);
//console.log("===============================================");

var testsPath = path.join(baseDir, testsFile);
try {
  var tests = require(testsPath);
}
catch(error) {
  configError("Problem trying to read the test definition file " + testsPath,
    error);
}

var catalogPath = catalogFile ? path.join(baseDir, catalogFile) : null;
if (catalogPath) {
  try {
    fs.statSync(catalogPath);
  }
  catch(error) {
    configError("Can't find catalog file " + catalogPath, error);
  }
}

// Finally, the individual test filenames that are called out inside
// the tests definition file are relative to the directory of that file
var testsDir = path.dirname(testsPath);

// Export now, because this data is used by the generator.js, which is
// "eval"ed by mocha.
module.exports = {
  baseDir: baseDir,
  testsDir: testsDir,
  tests: tests,
  catalogPath: catalogPath,
};

// Instantiate a test runner.
// See https://github.com/mochajs/mocha/wiki/Using-mocha-programmatically
var mocha = new Mocha({
  reporter: Mocha.reporters[reporter],
});

// Let mocha run our generator to create the tests
mocha.addFile(path.join(__dirname, 'generator.js'));

// Run them
mocha.run(function(failures) {
  process.on('exit', function() {
    process.exit(failures);
  });
});

function configError(msg, error) {
  console.error(msg);
  if (error) {
    console.error("The reported error was:\n  " + error.message);
  }
  process.exit(1);
}

