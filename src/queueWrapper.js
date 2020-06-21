/**
 * Wraps an async function so that subsequent calls to the function can be queued
 * while it is in progress, and resolved once the initial call has completed.
 * @param fn
 * @return {Promise<function(...[*]=)>}
 */
function queueWrapper(fn) {
  // These variables are necessary to queue requests while one is in progress.
  let inProgress = false;
  const queue = [];

  return async (data) => {
    // Deal with additional requests that occur while the initial request is in progress.
    if (inProgress) {
      return new Promise((resolve) => {
        queue.push(resolve);
      });
    }
    inProgress = true;

    const result = await fn(data);

    // Notify all listeners' callback function (Promise.resolve)
    queue.forEach((cb) => cb(result));
    queue.length = 0;
    inProgress = false;

    return result;
  };
}

module.exports = queueWrapper;
