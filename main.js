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


exports.run = function(_opts) {
  // baseDir is the base directory from which the `tests` and `catalog`
  // options are resolved. Set it to cwd (which is correct when this is
  // run from an npm script, which is our primary use case) unless given
  // an input option to override it (tbd).
  let defaults = {
    tests: 'test/tests.json',
    catalog: 'catalog.xml',
    reporter: 'nyan',
    baseDir: process.cwd(),
  };
  let opts = (typeof(_opts) == 'object')
    ? _.merge(opts, defaults)
    : commandLineOpts(defaults);
  if (opts.catalog == 'NONE') opts.catalog = null;

  // FIXME: use destructuring assignment when it is made the default
  /*  var {tests, catalog, reporter, baseDir} = opts; */
  let tests = opts.tests,
      catalog = opts.catalog,
      reporter = opts.reporter,
      baseDir = opts.baseDir;

  let testsPath = path.join(baseDir, tests);
  try {
    var testsData = require(testsPath);
  }
  catch(error) {
    error.message = 'Problem trying to read the test definition file. ' +
      error.message;
    throw error;
  }

  let catalogPath = catalog ? path.join(baseDir, catalog) : null;
  if (catalogPath) {
    try {
      fs.statSync(catalogPath);
    }
    catch(error) {
      error.message = 'Can\'t find catalog file. ' + error.message;
      throw error;
    }
  }

  // FIXME: is there any way to do this in the local scope of one
  // test suite?
  process.env.XML_CATALOG_FILES = catalogPath;

  // Finally, the individual test filenames that are called out inside
  // the tests definition file are relative to the directory of that file
  var testsDir = path.dirname(testsPath);

  return new Promise(function(resolve, _reject) {
    function reject(msg, error) {
      console.error(msg);
      if (error) {
        console.error("The reported error was:\n  " + error.message);
      }
      _reject(msg);
    }

    // Instantiate a test runner.
    // See https://github.com/mochajs/mocha/wiki/Using-mocha-programmatically
    var mocha = new Mocha({
      reporter: Mocha.reporters[reporter],
    });

    // Override the loadFiles method, to use our generator to define
    // tests. This is necessary because the original uses `require`, which
    // would only run generator once. Original code is here:
    // https://github.com/mochajs/mocha/blob/d811eb96/lib/mocha.js#L213
    // We know this will only get invoked with our 'dummy' file,
    // so we don't need to use the filename
    var origLoadFiles = mocha.loadFiles;
    mocha.loadFiles = function() {
      var self = this;
      var suite = this.suite;
      suite.emit('pre-require', global, __filename, self);
      suite.emit('require', generator(testsData, testsDir),
        __filename, self);
      suite.emit('post-require', global, __filename, self);
    };

    try {
      mocha.addFile('dummy');
    }
    catch(error) {
      reject("Error adding test generator to mocha runner.", error);
    }

    // Run them
    try {
      mocha.run(function(failures) {
        resolve(failures);
      });
    }
    catch(error) {
      reject("Error with mocha run.", error);
    }
  });
};


function commandLineOpts(d) {
  var version = require('./package.json').version;
  return program
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
}

// This generates the mocha tests. By some magic that I don't understand,
// various mocha functions like `it` and `describe` are in scope inside
// this function.
function generator(testsData, testsDir) {
  //console.log("generator global: ", global);
  //console.log("split: ", split);
  console.log("XML_CATALOG_FILES = " + process.env.XML_CATALOG_FILES);

  testsData.testCases.forEach(function(testCase) {
    (testCase.skip ? it.skip : it)(
      `${testCase.filename} should give expected results from validation`,
      function() {
        return testOne(testCase);
      }
    );
  });


  // Run one test case, checking that the results of the validation
  // are what we expect (valid or invalid).
  function testOne(testCase) {
    return new Promise(function(resolve, _reject) {
      var reject = rejector(testCase, _reject);
      var expect = testCase.expect || 'valid';
      return validate(testCase)
        .then(
          function() {
            // document is valid
            if (expect == 'valid') resolve();
            else reject("Expected document to be invalid");
          },
          function() {
            // document is invalid
            if (expect == 'valid')
              reject("Expected document to be valid");
            else resolve();
          }
        )
    });
  }

  // Validate an XML file, returns a promise that resolves if the
  // file is valid, or if it is invalid but only has "allowed" errors.
  function validate(testCase) {
    return new Promise(function(resolve, _reject) {
      var reject = rejector(testCase, _reject);
      var xmlPath = path.join(testsDir, testCase.filename);
      fs.readFile(xmlPath, function (error, data) {
        if (error) reject(error);

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
          reject(error);
          return;
        }
        var _badErrors = badErrors(testCase, doc);
        if (_badErrors) reject(_badErrors);
        else resolve();
      });
    });
  }

}


// Use this inside a promise function to get the function to call
// when you need to reject.
function rejector(testCase, reject) {
  // errors is either an atomic value or an array. We'll store all
  // errors on the testCase object.
  return function(errors) {
    testCase.errors =
      (testCase.errors ? testCase.errors : []).concat(errors);
    reject(testCase);
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
