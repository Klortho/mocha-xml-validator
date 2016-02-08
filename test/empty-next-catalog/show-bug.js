#!/usr/bin/env node
// Demonstrates the segfault with weird catalog configuration

var libxml = require("libxmljs-mt");
var fs = require('fs');
var path = require('path');

process.env.XML_CATALOG_FILES = path.join(__dirname, "catalog.xml");

var xmlPath = path.join(__dirname, 'article.xml');
fs.readFile(xmlPath, function (error, data) {
  if (error) {
    console.error(error);
    process.exit(1);
  }
  try {
    var doc = libxml.Document.fromXml(data, {
      dtdvalid: true,
      nonet: true,
      baseUrl: null,
    });
  }
  catch(error) {
    console.error(error);
    process.exit(1);
  }
  console.log('okay');
});



