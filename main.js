#!/usr/bin/env node

// Note that if there is a problem with the command line arguments, the
// test.json file, or almost anything else, we want this to act as a test
// failure, not a very rude, uninformative exception being thrown.
// We'll use configError for this, and generator.js will create a test
// that verifies that it is null.
var configError = null;

var Mocha = require('mocha'),
    fs = require('fs'),
    path = require('path'),
    getopt = require('node-getopt');

opt = getopt.create([
  ['', 'tests=ARG', 'JSON file that defines the tests; default is test/tests.json.'],
  ['', 'catalog=ARG', 'OASIS catalog file; default is catalog.xml.'],
  ['', 'reporter=ARG', 'Specify the test reporter for mocha to use; default is "nyan".'],
  ['h', 'help', 'Display help'],
])
.bindHelp()
.parseSystem();

var options = opt.options,
    testsFile = options.tests || 'test/tests.json',
    catalogFile = options.catalog || 'catalog.xml',
    reporter = options.reporter || 'nyan';

// The test and catalog files will be relative to the requiring module's directory
var testsDir = path.dirname(require.main.filename);
var testsPath = path.join(testsDir, testsFile);
try {
  var tests = require(testsPath);
}
catch(err) {
  tests = null;
  configError = err;
}
var catalogPath = path.join(testsDir, catalogFile);

// Export now, because this data is used by the generator.js, which is
// "eval"ed by mocha.
module.exports = {
  testsDir: testsDir,
  tests: tests,
  catalogPath: catalogPath,
  configError: configError,
};

// Instantiate a test runner.
// See https://github.com/mochajs/mocha/wiki/Using-mocha-programmatically
var mocha = new Mocha({
  reporter: Mocha.reporters[reporter],
});

// Let mocha run our generator to create the tests
mocha.addFile(path.join(__dirname, 'generator.js'));

// Run them
mocha.run(function(){
  process.on('exit', function (exitCode) {
    process.exit(exitCode);
  });
});




