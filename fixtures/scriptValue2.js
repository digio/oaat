const queueWrapper = require('../src/queueWrapper');

function doAsyncThing({ serverUrl }) {
  return new Promise((resolve) => {
    setTimeout(() => resolve('async value 2'), 100);
  });
}

module.exports = queueWrapper(doAsyncThing);
