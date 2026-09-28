const Joi = require('joi');

const appointmentSchema = Joi.object({
  doctorId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      'string.pattern.base': 'Valid doctor ID is required',
      'any.required': 'Doctor ID is required',
    }),
  clinicId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      'string.pattern.base': 'Valid clinic ID is required',
      'any.required': 'Clinic ID is required',
    }),
  appointmentDate: Joi.string()
    .pattern(/^\d{4}-\d{2}-\d{2}$/)
    .required()
    .messages({
      'string.pattern.base': 'Appointment date must be in YYYY-MM-DD format',
      'any.required': 'Appointment date is required',
    }),
  appointmentTime: Joi.string()
    .pattern(/^([01]\d|2[0-3]):[0-5]\d$/)
    .optional()
    .allow('', null)
    .messages({
      'string.pattern.base': 'Appointment time must be in HH:mm format (24-hour)',
    }),
  type: Joi.string().valid('NEW', 'FOLLOW-UP').default('NEW'),
});

module.exports = {
  appointmentSchema,
};
