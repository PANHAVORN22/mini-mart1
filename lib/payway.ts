import crypto from 'crypto';

/**
 * Generates a hash for PayWay API requests
 *
 * @param values - Array of values to include in the hash
 * @param apiKey - The API key to use for hashing
 * @returns Base64 encoded hash
 */
export function generatePaywayHash(values: (string | number)[], apiKey: string): string {
  // Concatenate all values
  const b4hash = values.join('');

  // Generate HMAC SHA-512 hash and encode in Base64
  return Buffer.from(crypto.createHmac('sha512', apiKey).update(b4hash).digest()).toString('base64');
}

/**
 * Formats a date for PayWay API requests in the format YYYYMMDDHHmmss
 *
 * @param date - Date to format (defaults to current date/time)
 * @returns Formatted date string
 */
export function formatPaywayDate(date: Date = new Date()): string {
  return date.toISOString().replace(/[-:T.]/g, '').slice(0, 14);
}

/**
 * Formats a date for PayWay API date range parameters in the format YYYY-MM-DD HH:mm:ss
 *
 * @param date - Date to format
 * @returns Formatted date string
 */
export function formatPaywayDateRange(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * Encodes an object as base64 JSON string for PayWay API
 *
 * @param data - Object to encode
 * @returns Base64 encoded JSON string
 */
export function encodePaywayData(data: any): string {
  return Buffer.from(JSON.stringify(data)).toString('base64');
}

/**
 * PayWay API configuration
 */
export const PaywayConfig = {
  merchantId: process.env.PAYWAY_MERCHANT_ID || '',
  apiKey: process.env.PAYWAY_API_KEY || '',
  baseUrl: process.env.PAYWAY_BASE_URL || 'https://checkout-sandbox.payway.com.kh',
  appUrl: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
};
