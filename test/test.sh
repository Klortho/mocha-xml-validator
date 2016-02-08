#!/bin/bash
# From `npm test`, the cwd is the project base directory.

./validate.js --catalog=test/catalog.xml
(cd test && ../validate.js --tests=tests.json)

test/test1.js
(cd test && ./test2.js)
