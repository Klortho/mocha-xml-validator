var chai = require('chai');
var fs = require('fs');
var libxml = require("libxmljs-mt");

// Get the test cases, and some options, from main
var main = require('./main');
var tests = main.tests;
var testCases = tests.testCases;
process.env.XML_CATALOG_FILES = main.catalog;

testCases.forEach(function(testCase) {
  (testCase.skip ? it.skip : it)(`${testCase.filename} should validate`, function() {
    return validate(testCase);
  });
});

// Validate an XML file, returns a promise
function validate(testCase) {
  return new Promise(function(resolve, reject) {
    // We'll call this when there's a problem
    function _reject(errs) {
      testCase.errors = errs;
      reject(testCase);
    }

    fs.readFile(testCase.filename, function (err, data) {
      if (err) _reject(err);
      libxml.Document.fromXmlAsync(data,
        {
          dtdvalid: true,
          nonet: true,
          //xinclude: true,   #=> not working in libxmljs-mt
        },
        function(err, doc) {
          if (err) _reject(err);
          else {
            var _badErrors = badErrors(testCase, doc);
            if (_badErrors) _reject(_badErrors);
            else resolve();
          }
        });
    });
  });
}

// Helper function to determine if a list of errors has any that
// do not match errorsAllowed. It returns the filtered list, if so,
// or else false, if not
function badErrors(testCase, doc) {
  var docErrors = doc && doc.errors ? doc.errors : [];
  var _badErrors = docErrors.filter(function(err) {
    var errorsAllowed = testCase.errorsAllowed || [];
    // The filter function returns true if it's a bad error, meaning that
    // it doesn't match any of the allowedErrors
    return !errorsAllowed.find(function(allowedError) {
      return err.toString().indexOf(allowedError) >= 0;
    });
  });
  return _badErrors.length > 0 ? _badErrors : false;
}

