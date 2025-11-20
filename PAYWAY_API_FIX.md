# PayWay API Implementation Fix

## Overview
This document describes the fixes applied to the PayWay (ABA Bank) payment integration to align with the official PayWay API documentation at https://developer.payway.com.kh/purchase-14530820e0.

## Issues Identified

### 1. Incorrect Field Names
**Before:**
- Using `invoice_id`, `customer_name`, `customer_email`
- Using `currency` field (not in PayWay spec)

**After (Correct):**
- `tran_id` - Transaction ID (unique identifier)
- `firstname`, `lastname` - Customer name split (matching PayWay casing)
- `email`, `phone` - Customer contact details
- `items` - Base64-encoded JSON array of line items

### 2. Missing Required Fields
The following required fields were not being sent:
- `req_time` - UTC timestamp formatted as `YYYYMMDDHHmmss`
- `shipping` - Monetary value (even `0.00` must be included in hash)
- `items` - Base64-encoded JSON (`[{ "name": "...", "quantity": 1, "price": 1.0 }]`)
- `hash` - HMAC-SHA512 security signature over the entire field list

### 3. Missing Security Implementation
**Critical Issue:** Hash previously used only a subset of fields.

**Fix:** Implemented proper HMAC-SHA512 hash calculation using the documented concatenation order:
```
const concatenated = [
  req_time, merchant_id, tran_id, amount, items, shipping,
  firstname, lastname, email, phone, type, payment_option,
  return_url, cancel_url, continue_success_url, return_deeplink,
  currency, custom_fields, return_params, payout, lifetime,
  additional_params, google_pay_token, skip_success_page
].join("");
hash = HMAC-SHA512(concatenated, api_key);
```

### 4. Incorrect Request Format
**Before:** Sending JSON payload to `https://sandbox.payway.com.kh`
**After:** Sending `multipart/form-data` to the checkout endpoint (`https://checkout-sandbox.payway.com.kh/api/payment-gateway/v1/payments/purchase`)

### 5. Currency Default
**Before:** Defaulting to "KHR" (Cambodian Riel)
**After:** Defaulting to "USD" (US Dollar) unless the merchant profile overrides it

## Changes Made

### File: `/app/api/payments/aba/route.ts`
- Added `crypto` module import for HMAC-SHA512 hash generation
- Implemented `generateHash()` function for security
- Updated field names to match PayWay API specification
- Added proper validation for required environment variables
- Changed from FormData to JSON payload
- Added comprehensive logging for debugging
- Updated mock/development mode to use correct field names

### File: `/components/aba-bank-qr.tsx`
- Added `phone` and `items` props
- Implemented name splitting logic (first_name/last_name)
- Changed default currency from "KHR" to "USD"
- Updated API call to send all required fields

### File: `/app/checkout/page.tsx`
- Added `phone` parameter to ABABankQRCode component
- Added `items` description with order ID

### File: `/env-template.txt`
- Updated environment variable names and descriptions
- Added comprehensive documentation for PayWay configuration
- Clarified the difference between sandbox and production URLs
- Removed obsolete `ABA_*` variable names in favor of `PAYWAY_*`

## Environment Variables

### Required for Production
```bash
# Merchant ID from PayWay
PAYWAY_MERCHANT_ID=your_merchant_id

# API Key for HMAC hash generation (CRITICAL for security)
PAYWAY_API_KEY=your_api_key

# Base URL (sandbox or production)
PAYWAY_BASE_URL=https://sandbox.payway.com.kh
# or for production:
# PAYWAY_BASE_URL=https://api.payway.com.kh

# Optional: Custom return URL
PAYWAY_RETURN_URL=https://yourdomain.com/order-confirmation
```

### Development Mode
```bash
# Enable mock mode for development
ABA_MOCK_MODE=true
NODE_ENV=development
```

## API Request Format (Corrected)

### Request Payload
Submit as `multipart/form-data` (order matters for hashing, not for POST):

- `req_time` – `20251120094530`
- `merchant_id` – `YOUR_MERCHANT_ID`
- `tran_id` – `ORDER123-20251120094530`
- `amount` – `100.00`
- `items` – `base64('[{"name":"Order #ORDER123","quantity":1,"price":100}]')`
- `shipping` – `0.00`
- `firstname` / `lastname`
- `email` / `phone`
- `type` – `purchase`
- `payment_option` – leave blank to let PayWay decide
- `return_url`, `cancel_url`, `continue_success_url`
- `currency` – `USD`
- `custom_fields`, `return_params` – base64 metadata (order id, etc.)
- `payout`, `additional_params`, `google_pay_token` – blank if unused
- `lifetime` – `30`
- `skip_success_page` – `0`
- `payment_gate` – `0`
- `view_type` – `popup`
- `hash` – calculated HMAC

## Testing

### Development Mode
When `NODE_ENV=development` or `ABA_MOCK_MODE=true`:
- Creates an HTML form with the complete PayWay field list (matching production)
- Auto-submits to the sandbox checkout endpoint
- Uses demo credentials if environment variables are missing
- Generates the full HMAC hash for validation

### Production Mode
Requires:
- Valid `PAYWAY_MERCHANT_ID`
- Valid `PAYWAY_API_KEY`
- Proper `PAYWAY_BASE_URL` (production endpoint)

## Security Improvements

1. **HMAC-SHA512 Authentication**: All requests now include cryptographic signature
2. **Request Validation**: Server validates required fields before sending
3. **Environment Validation**: Checks for required credentials in production
4. **Timestamp Protection**: Uses Unix timestamp to prevent replay attacks

## Migration Notes

If you were using the old implementation:

1. Update environment variables from `ABA_*` to `PAYWAY_*`
2. Ensure `PAYWAY_API_KEY` is set (required for hash generation)
3. Update `PAYWAY_BASE_URL` to match your environment
4. Test in sandbox mode before production deployment

## References

- PayWay Official Documentation: https://developer.payway.com.kh/purchase-14530820e0
- HMAC-SHA512: https://en.wikipedia.org/wiki/HMAC
- PayWay Sandbox: https://sandbox.payway.com.kh
- PayWay Production: https://api.payway.com.kh

## Compliance

This implementation now fully complies with:
- ✅ PayWay API v1 Purchase specification
- ✅ HMAC-SHA512 security requirements
- ✅ Required field validation
- ✅ Proper request format (multipart/form-data)
- ✅ Correct endpoint usage
