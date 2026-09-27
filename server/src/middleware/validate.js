const ApiError = require('../utils/apiError');

const validate = (schema, property = 'body') => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const details = error.details.map((detail) => ({
        field: detail.path.join('.'),
        message: detail.message.replace(/['"]/g, ''),
      }));

      return next(ApiError.badRequest(details[0].message, 'VALIDATION_ERROR', details));
    }

    req[property] = value;
    next();
  };
};

module.exports = validate;
