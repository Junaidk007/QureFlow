const Joi = require('joi');

const doctorStatusSchema = Joi.object({
  status: Joi.string().valid('AVAILABLE', 'ON_BREAK').required().messages({
    'any.only': 'Status must be either AVAILABLE or ON_BREAK',
    'any.required': 'Status is required',
  }),
  breakMinutes: Joi.number().integer().min(1).max(120).optional().default(10),
});

module.exports = {
  doctorStatusSchema,
};
