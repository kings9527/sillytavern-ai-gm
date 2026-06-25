/**
 * Input Sanitization Utilities
 * Prevents XSS and sanitizes user input for safe display.
 *
 * @version 0.1.0
 */

/**
 * Escape HTML special characters to prevent XSS
 * @param {string} text - Raw text to escape
 * @returns {string} HTML-escaped text
 */
export function escapeHtml(text) {
  if (typeof text !== 'string') return String(text);
  // (removed unused: div)
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

/**
 * Sanitize player input for safe processing
 * Removes control characters and limits length
 * @param {string} input - Raw player input
 * @param {number} maxLength - Maximum allowed length (default: 1000)
 * @returns {string} Sanitized input
 */
export function sanitizeInput(input, maxLength = 1000) {
  if (!input || typeof input !== 'string') return '';

  // Remove control characters except newlines
  // eslint-disable-next-line no-control-regex
  let sanitized = input.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '');

  // Trim whitespace
  sanitized = sanitized.trim();

  // Limit length
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength) + '...';
  }

  return sanitized;
}

/**
 * Sanitize narration text for safe display
 * Removes dangerous HTML/JS while preserving basic formatting
 * @param {string} text - Raw narration text
 * @returns {string} Sanitized narration
 */
export function sanitizeNarration(text) {
  if (typeof text !== 'string') return String(text);

  // Remove script tags and their content
  let sanitized = text.replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gi, '');

  // Remove event handlers (on*="...")
  sanitized = sanitized.replace(/\s*on\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]*)/gi, '');

  // Remove javascript: URLs
  sanitized = sanitized.replace(/javascript:/gi, '');

  // Remove data URIs that could execute JS
  sanitized = sanitized.replace(/data:text\/html/gi, '');

  return sanitized;
}

/**
 * Validate campaign ID format
 * @param {string} id - Campaign ID to validate
 * @returns {boolean} True if valid
 */
export function isValidCampaignId(id) {
  if (!id || typeof id !== 'string') return false;
  return /^campaign_\d+_[a-z0-9]+$/.test(id);
}

/**
 * Validate dice expression format
 * @param {string} expression - Dice expression
 * @returns {boolean} True if valid format
 */
export function isValidDiceExpression(expression) {
  if (!expression || typeof expression !== 'string') return false;
  return /^[\d\s+dD+-]+$/.test(expression.trim());
}

/**
 * Validate module structure
 * @param {object} module - Module object to validate
 * @returns {{valid: boolean, errors: string[]}} Validation result
 */
export function validateModule(module) {
  const errors = [];

  if (!module || typeof module !== 'object') {
    return { valid: false, errors: ['Module must be an object'] };
  }

  if (!module.id) errors.push('Module missing required field: id');
  if (!module.name) errors.push('Module missing required field: name');
  if (!module.system) errors.push('Module missing required field: system');
  if (!module.start_scene) errors.push('Module missing required field: start_scene');
  if (!module.scenes || Object.keys(module.scenes).length === 0) {
    errors.push('Module must have at least one scene');
  }

  // Validate scenes
  if (module.scenes) {
    for (const [sceneId, scene] of Object.entries(module.scenes)) {
      if (!scene.id) errors.push(`Scene ${sceneId} missing id`);
      if (!scene.title) errors.push(`Scene ${sceneId} missing title`);
      if (!scene.description) errors.push(`Scene ${sceneId} missing description`);
    }
  }

  return { valid: errors.length === 0, errors };
}
