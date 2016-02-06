var chai = require('chai'),
    fs = require('fs'),
    libxml = require("libxmljs-mt"),
    path = require('path');

var assert = chai.assert;

// Get the test cases, and some options, from main
var main = require('./main');
var testsDir = main.testsDir,
    tests = main.tests,
    catalogPath = main.catalogPath,
    configError = main.configError;

/*
console.log("----------------------\n");
console.log("testsDir: ", testsDir);
console.log("tests: ", tests);
console.log("catalogPath: ", catalogPath);
console.log("configError: ", configError);
*/
process.env.XML_CATALOG_FILES = catalogPath;

it('Parent project should not have any configuration problems',
  function(done) {
    var okay = (configError == null),
        msg = okay ? '' : configError.toString();
    assert(okay, msg);
    done();
  }
);

if (!configError) {
  var testCases = tests.testCases;

  testCases.forEach(function(testCase) {
    (testCase.skip ? it.skip : it)(
      `${testCase.filename} should give expected results from validation`,
      function() {
        return testOne(testCase);
      }
    );
  });
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

