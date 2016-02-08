This test case is currently causing a segfault, and it's not related
to the changes I made in libxmljs-cfm. I know this because I set baseUrl
to null, and tested with libxmljs-mt, and the problem still occurs.

I created show-bug.js here to illustrate it.

Or, from this validator appliction:

    ../../main.js --tests=tests.json
