const Visit = require('../models/Visit');

/**
 * Mint a sequential daily token for a doctor
 * Format: "A-{sequentialNumber}" (e.g. "A-1", "A-2", "A-17")
 *
 * @param {string|ObjectId} doctorId
 * @param {string} visitDate - Format: YYYY-MM-DD
 * @param {string} prefix - Default "A"
 * @returns {Promise<string>}
 */
const mintToken = async (doctorId, visitDate, prefix = 'A') => {
  if (!doctorId || !visitDate) {
    throw new Error('doctorId and visitDate (YYYY-MM-DD) are required to mint a token');
  }

  // Count all visits created for this doctor on this day
  const existingCount = await Visit.countDocuments({
    doctorId,
    visitDate,
  });

  const nextSequence = existingCount + 1;
  return `${prefix}-${nextSequence}`;
};

module.exports = {
  mintToken,
};
