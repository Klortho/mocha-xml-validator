#!/usr/bin/env node

'use strict';
var _ = require('lodash');
var chai = require('chai');
var fs = require('fs');
var libxml = require("libxmljs-cfm");
var Mocha = require('mocha');
var path = require('path');
var program = require('commander');

var assert = chai.assert;

// baseDir is the base directory from which the `tests` and `catalog`
// options are resolved. Set it to cwd (which is correct when this is
// run from an npm script, which is our primary use case) unless given
// an input option to override it (tbd).
var defaults = {
  tests: 'test/tests.json',
  catalog: 'catalog.xml',
  reporter: 'nyan',
  baseDir: process.cwd(),
};

// Exported run function. Creates a new TestSuite and runs
// immediately. Returns a promise that will either resolve with
// the number of failures, or reject with an Error.
function run(opts) {
  var testSet = new TestSet();
  var clopts = commandLineOpts(defaults);
  testSet.newSuite(opts || clopts);

  return testSet.run();
}
exports.run = run;

// Constructor for a TestSet, each of which can have many suites.
function TestSet() {
  this.suites = [];
}

// Create a new test suite based on the options, and push it onto
// this TestSets suites list. This doesn't return anything, but
// might throw an Error.
TestSet.prototype.newSuite = function(_opts) {
  var testSet = this;
  var suite = _.merge({}, defaults, _opts);
  testSet.suites.push(suite);
  if (suite.catalog == 'NONE') suite.catalog = null;

  // Keep it simple: every property is also a local variable,
  // and vice-versa
  var tests = suite.tests;
  var catalog = suite.catalog;
  var reporter = suite.reporter;
  var baseDir = suite.baseDir;

  var testsPath = suite.testsPath = path.join(baseDir, tests);
  try {
    var testsData = suite.testsData = require(testsPath);
  }
  catch(error) {
    error.message = 'Problem trying to read the test definition file. ' +
      error.message;
    throw error;
  }

  var catalogPath = suite.catalogPath =
    catalog ? path.join(baseDir, catalog) : null;
  if (catalogPath) {
    try {
      fs.statSync(catalogPath);
    }
    catch(error) {
      error.message = 'Can\'t find catalog file. ' + error.message;
      throw error;
    }
  }

  // Finally, the individual test filenames that are called out inside
  // the tests definition file are relative to the directory of that file
  var testsDir = suite.testsDir = path.dirname(testsPath);

  // Instantiate a test runner.
  // See https://github.com/mochajs/mocha/wiki/Using-mocha-programmatically
  var mocha = suite.mocha = new Mocha({
    reporter: Mocha.reporters[reporter],
  });

  // Override the loadFiles method, to use our generator to define
  // tests. This is necessary because the original uses `require`, which
  // would only run generator once. Original code is here:
  // https://github.com/mochajs/mocha/blob/d811eb96/lib/mocha.js#L213
  // We know this will only get invoked with our 'dummy' file,
  // so we don't need to use the filename
  //suite.filesLoaded = false;
  mocha.loadFiles = function() {
    // Make sure this only gets called once
    //console.log("===> loadFiles, filesLoaded = ", suite.filesLoaded);
    //if (suite.filesLoaded) return;
    //suite.filesLoaded = true;

    var self = this;
    var _suite = this.suite;
    _suite.emit('pre-require', global, __filename, self);
    _suite.emit('require', generator(suite), __filename, self);
    _suite.emit('post-require', global, __filename, self);
  };

  // addFile will cause loadFiles to be called, which will in turn
  // call the generator.
  try {
    mocha.addFile('dummy');
    // Try this: calling loadFiles now, because otherwise it's
    // delayed until run()
    //mocha.loadFiles();
  }
  catch(error) {
    error.message = 'Error adding test generator to mocha runner. ' +
      error.message;
    throw error;
  }
};

// Run the entire test set. This returns a promise that will either
// resolve with the number of failures, or reject with an Error.
TestSet.prototype.run = function() {
  var testSet = this;

  return runSuite(testSet.suites[0]);

  // Run the test suites sequentially. This is needed because it
  // uses process.env.XML_CATALOG_FILES, which is global.
  // For a description of this pattern of using Promises with reduce, see
  // http://www.html5rocks.com/en/tutorials/es6/promises/#toc-creating-sequences
  //return testSet.suites.reduce(
  //  function(sequence, suite) {
  //    return sequence.then(function() {
  //      return runSuite(suite);
  //    });
  //  },
  //  Promise.resolve()
  //);
};

// Run one suite. This returns a promise that will either
// resolve with the number of failures, or reject with an Error.
function runSuite(suite) {
  return new Promise(function(resolve, reject) {
    try {
      // FIXME: I think this sets this globally, preventing running
      // suites in parallel.
      process.env.XML_CATALOG_FILES = suite.catalogPath;

      // Run the tests
      suite.mocha.run(function(failures) {
        resolve(failures);
      });
    }
    catch(error) {
      error.message = "Error with mocha run. " + error.message;
      reject(error);
    }
  });
};

function commandLineOpts(d) {
  var version = require('./package.json').version;
  var opts = program
    .version(version)
    .usage('[options]')
    .option(`-t, --tests [${d.tests}]`,
            'JSON file that defines the tests.',
            d.tests)
    .option(`-c, --catalog [${d.catalog}]`,
            'OASIS catalog file. Use the value NONE to specify no catalog.',
            d.catalog)
    .option(`-r, --reporter [${d.reporter}]`,
            'Specify the test reporter for mocha to use.',
            d.reporter)
    .option('-b, --base-dir [<cwd>]',
            'Base directory',
            d.baseDir)
    .parse(process.argv);
  return _.pick(opts, _.keys(defaults));
}

// This generates the mocha tests. By some magic that I don't understand,
// various mocha functions like `it` and `describe` are in scope inside
// this function. This will throw an exception of something bad happens.
function generator(suite) {
  //console.log("testsData: ", suite.testsData);
  suite.testsData.testCases.forEach(function(testCase) {
    testCase.errors = [];
    (testCase.skip ? it.skip : it)(
      `${testCase.filename} should give expected results from validation`,
      function() {
        return testOne(testCase);
      }
    );
  });

  // This run one test case, and is executed by Mocha. It checks
  // that the results of the validation are what we expect (valid
  // or invalid). It returns a promise that resolves if the test
  // passes, and rejects otherwise. The actual value passed back
  // by a reject is the testCase, which keeps a list of Errors.
  function testOne(testCase) {
    return new Promise(function(resolve, reject) {
      var expect = testCase.expect || 'valid';
      return validate(testCase)
        .then(
          function() {
            // document is valid
            if (expect == 'valid') resolve();
            else {
              testCase.errors.push(
                new Error("Expected document to be invalid"));
              reject(testCase);
            }
          },
          function() {
            // document is invalid
            if (expect == 'valid') {
              testCase.errors.push(
                new Error("Expected document to be valid"));
              reject(testCase);
            }
            else resolve();
          }
        )
    });
  }

  // Validate an XML file, returns a promise that resolves if the
  // file is valid, or if it is invalid but only has "allowed" errors.
  // If it rejects, the value passed back is the testCase, with a
  // list of validation errors in its `errors` property.
  function validate(testCase) {
    return new Promise(function(resolve, reject) {
      var xmlPath = path.join(suite.testsDir, testCase.filename);
      fs.readFile(xmlPath, function (error, data) {
        if (error) {
          testCase.errors.push(error);
          reject(testCase);
          return;
        }

        // I wanted to use fromXmlAsync from libxmljs-mt, but
        // neither it, nor the original libxmljs library supported
        // the baseUrl parameter, and it was much easier to hack it
        // into the syncronous function.
        try {
          var doc = libxml.Document.fromXml(data, {
            dtdvalid: true,
            nonet: true,
            baseUrl: xmlPath,
            //xinclude: true,   #=> not working in libxmljs-mt
          });
        }
        catch(error) {
          testCase.errors.push(error);
          reject(testCase);
          return;
        }

        var _badErrors = badErrors(testCase, doc);
        if (_badErrors) {
          testCase.errors = testCase.errors.concat(_badErrors);
          reject(testCase);
        }
        else resolve();
      });
    });
  }

}


// Helper function to determine if a list of errors has any that
// do not match errorsAllowed. It returns the filtered list, if so,
// or else false, if not
function badErrors(testCase, doc) {
  var docErrors = doc && doc.errors ? doc.errors : [];
  var _badErrors = docErrors.filter(function(error) {
    var errorsAllowed = testCase.errorsAllowed || [];
    // The filter function returns true if it's a bad error, meaning that
    // it doesn't match any of the allowedErrors
    return !errorsAllowed.find(function(allowedError) {
      return error.toString().indexOf(allowedError) >= 0;
    });
  });
  return _badErrors.length > 0 ? _badErrors : false;
}

