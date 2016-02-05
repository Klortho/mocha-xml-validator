#!/usr/bin/env node

var Mocha = require('mocha'),
    fs = require('fs'),
    path = require('path');

// Get the test json file that was passed in as an argument
var testFile = path.join(process.cwd(), process.argv[2])
console.log("Reading tests from " + testFile);
module.exports.tests = require(testFile);
module.exports.catalog = 'node_modules/jats-tag-library-dtd/catalog.xml';

var mocha = new Mocha({
  reporter: Mocha.reporters.nyan,
});


console.log(__dirname);
mocha.addFile(path.join(__dirname, 'generator.js'));

mocha.run(function(){
  process.on('exit', function (exitCode) {
    process.exit(exitCode);
  });
});