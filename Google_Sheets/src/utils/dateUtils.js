/**
 * @file src/utils/dateUtils.js (UPDATED v2.0)
 * @description Date formatting utilities - YYYY-MM-DD HH:MM:SS format
 */

/**
 * Format date to YYYY-MM-DD HH:MM:SS
 * @param {Date} [date=new Date()] - Date to format
 * @returns {string} Formatted date string
 */
function formatDateTime(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * Format date to YYYY-MM-DD only
 * @param {Date} [date=new Date()] - Date to format
 * @returns {string} Formatted date string
 */
function formatDate(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
}

/**
 * Format comment with timestamp and emoji (YYYY-MM-DD HH:MM:SS format)
 * @param {string} emoji - Emoji to prepend
 * @param {string} message - Comment message
 * @returns {string} Formatted comment
 */
function formatComment(emoji, message) {
    return `${formatDateTime()} ${emoji} ${message}`;
}