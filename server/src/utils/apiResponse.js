/**
 * Centralized API Response Formatter
 */
class ApiResponse {
  /**
   * Send a standardized success response
   * @param {import('express').Response} res
   * @param {*} data
   * @param {string} message
   * @param {number} statusCode
   * @param {Object|null} meta
   */
  static success(res, data = {}, message = 'Success', statusCode = 200, meta = null) {
    const payload = {
      status: 'success',
      message,
      data,
    };

    if (meta) {
      payload.meta = meta;
    }

    return res.status(statusCode).json(payload);
  }

  /**
   * Send a standardized 201 Created response
   * @param {import('express').Response} res
   * @param {*} data
   * @param {string} message
   * @param {Object|null} meta
   */
  static created(res, data = {}, message = 'Resource created successfully', meta = null) {
    return ApiResponse.success(res, data, message, 201, meta);
  }
}

module.exports = ApiResponse;
