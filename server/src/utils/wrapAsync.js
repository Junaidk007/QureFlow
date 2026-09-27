/**
 * Higher-order wrapper for asynchronous Express controller handlers.
 * Automatically catches rejected promises and passes them to next().
 *
 * @param {Function} fn - Async controller function (req, res, next)
 * @returns {Function} Express middleware handler
 */
const wrapAsync = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

module.exports = wrapAsync;
