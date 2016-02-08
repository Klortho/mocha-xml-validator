#!/bin/bash
# From `npm test`, the cwd is the project base directory.

set -o errexit
set -o pipefail
set -x

./main.js --tests=test/misc-cases/tests.json \
    --catalog=test/misc-cases/catalog.xml

# Test that it works when run from different directories, as long as
# the relative paths are correct
( cd test && \
  ../main.js --tests=misc-cases/tests.json \
      --catalog=misc-cases/catalog.xml )

( cd test/misc-cases && \
  ../../main.js --tests=tests.json )

# The test case here is skipped; xinclude is not working
./main.js --tests=test/xinclude/tests.json \
    --catalog=test/xinclude/catalog.xml

# This one is skipped for real; see the README in that directory
#./main.js --tests=test/empty-next-catalog/tests.json
#    --catalog=test/empty-next-catalog/catalog.xml

node test/script1.js

