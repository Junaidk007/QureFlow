const Joi = require('joi');

const checkInSchema = Joi.object({
  clinicId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      'string.pattern.base': 'Valid clinic ID is required',
      'any.required': 'Clinic ID is required',
    }),
  appointmentId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      'string.pattern.base': 'Valid appointment ID is required',
      'any.required': 'Appointment ID is required',
    }),
});

const walkInSchema = Joi.object({
  clinicId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      'string.pattern.base': 'Valid clinic ID is required',
      'any.required': 'Clinic ID is required',
    }),
  patientName: Joi.string().trim().min(2).max(50).required().messages({
    'string.empty': 'Patient name is required',
    'string.min': 'Patient name must be at least 2 characters',
    'any.required': 'Patient name is required',
  }),
  phone: Joi.string().trim().optional().allow(''),
  doctorId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      'string.pattern.base': 'Valid doctor ID is required',
      'any.required': 'Doctor ID is required',
    }),
  type: Joi.string().valid('NEW', 'FOLLOW-UP').default('NEW'),
  isUrgent: Joi.boolean().default(false),
});

const completeSchema = Joi.object({
  vitals: Joi.object({
    bp: Joi.string().trim().allow(null, '').optional(),
    sugar: Joi.number().allow(null).optional(),
    weight: Joi.number().allow(null).optional(),
  }).optional(),
  notes: Joi.string().trim().allow(null, '').optional(),
});

module.exports = {
  checkInSchema,
  walkInSchema,
  completeSchema,
};
