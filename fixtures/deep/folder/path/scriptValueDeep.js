const queueWrapper = require('../../../../src/queueWrapper');

function doAsyncThing({ serverUrl }) {
  return new Promise((resolve) => {
    setTimeout(() => resolve('async value deep'), 100);
  });
}

module.exports = queueWrapper(doAsyncThing);
