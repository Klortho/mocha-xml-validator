#!/usr/bin/env node

// Test programmatically running multiple suites.

var mxv = require('../main');   // main.js

var testSet = new mxv.TestSet();
testSet.newSuite({catalog: 'test/catalog.xml'});
testSet.newSuite({catalog: 'test/catalog.xml'});
testSet.run();

