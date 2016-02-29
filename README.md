# mocha-xml-validator

This is a validation tool for XML files and their DTDs.

It's an integrated package that uses mocha to run tests that are
defined in a tests.json file -- no coding is required.

To use it, first run this in your Node.js project directory:

```
npm install --save-dev mocha-xml-validator
```

Then, add this to your package.json:

```json
"scripts": {
  "test": "mxv-validate"
},
```

Next, create a test directory, and a tests.json file within that,
in the format illustrated by this example. Each entry in `testCases`
specifies an XML file that will be run through the validator.

```json
{
  "testCases": [
    { "filename": "test-1.xml" },
    { "filename": "test-2.xml",
      "errorsAllowed": [ "IDREF" ] },

    { "filename": "skip-1.xml" },
    { "filename": "skip-2.xml",
      "skip": true,
      "reason": "Need to skip this one for now." },
    { "filename": "skip-3.xml",
      "skip": true,
      "reason": "#reason-code-3" }
  ],
  "reasonCodes": {
    "reason-code-3": "A bunch of files need to be skipped for now."
  }
}
```

**Note that the JSON format is very finicky. We suggest that you use the
online [jsonlint tool](http://jsonlint.com/) to check your JSON file,
if you are having problems.**

Each entry in the `testCases` array is run as a separate test.

In the example above, test-1.xml is expected to pass validation with
no problems.

test-2.xml, on the other hand, has known problems that
we want to ignore. `errorsAllowed` is an array of strings that are matched
against the error messages coming from the (libxml2) validator. If an
error message matches any of the strings in that list, it is ignored.
So, test-2.xml will fail only if it fails validation with errors that don't
match any in the list.

If for some reason you need to temporarily skip tests, you can indicate
that by setting `skip` to `true`, and optionally giving a reason. In the
example above, skip-1.xml is skipped, and the author declined to indicate
a reason. skip-2.xml is skipped with the reason given directly in the `reason`
field. The example for skip-3.xml illustrates that you can re-use the same
reason for many test cases: if the first character of the `reason` field is
a hash sign, then it's considered to be a reference to the corresponding
entry in the `reasonCodes` object at the bottom.

Finally, to run the tests:

```
npm test
```

You can also run this tool directly from the command line, if you
install it globally:

```
npm install -g mocha-xml-validator
```

Then, run `mxv-validate --help` to get information about the available
command-line options.

## Running programmatically

To run from within a Node script:

```
var mxv = require('mocha-xml-validator');

// Generate a single test suite and run immediately:
mxv.run(opts);    // Pass in options, and run

// Or, generate multiple test suites separately, and then run
var testSet = new mxv.TestSet(setOpts);
testSet.newSuite(suiteOpts_1);
testSet.newSuite(suiteOpts_2);
testSet.run();
```

Some options (right now, only `reporter`) apply to sets as a whole,
and others are per-suite.


## XML processing - libxmljs

This uses a fork of [libxmljs](https://www.npmjs.com/package/libxmljs);
[klortho/libxmljs](https://github.com/klortho/libxmljs). See
[this pull request](https://github.com/polotek/libxmljs/pull/388).


## To-do

* As mentioned above, this is using a fork of libmxljs. Whenever that PR
  gets pulled and released, switch to that version.
* Add unit tests for some more of the command-line options (reporter and
  baseDir)
* Add ability to declaratively create multiple test suites.
  (We already needed this for w3c-schema-dtd.) Ideas:
    * Catalog could be specified inside the tests.json file: one catalog /
      json file seems like a good rule
    * Need a way to specify multiple tests.json files. Either the command
      line, an inclusion mechanism, or maybe just allow one "master file".
* Cleaner reporting of validation errors


### XInclude is not working

The Tag Library sources use XInclude, and it would
be nice to be able to validate with that, but not essential.

I think there is a bug in the library we're using,
[libxmljs-mt](https://www.npmjs.com/package/libxmljs-mt). I even tried
to fix it, [here](https://github.com/Klortho/libxmljs/commit/f0164f89cfefb17963cc739e6b20b9ae91d9418d)
(included in my [pull request](https://github.com/gagern/libxmljs/pull/7))
but it did not work. See also the file try-xinclude.js.

Note that the XInclude problem has nothing to do with validation: the
\<xi:include> elements are just not getting expanded. But, assuming we
were able to get that working, there might be another problem. In order
to validate files that use xinclude, in xmllint, for example, you have
to give it the `--postvalid` argument, to ensure that validation happens
after all the expansions. I don't see that option in libxmljs-mt.
