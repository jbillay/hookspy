import { describe, it, expect } from 'vitest'
import {
  isValidUUID,
  validateTargetUrl,
  validateCustomHeaders,
  validateEndpoint,
} from '../../../api/_lib/validation.js'

describe('validation.js', () => {
  describe('isValidUUID', () => {
    it('accepts valid UUID v4', () => {
      expect(isValidUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true)
    })

    it('accepts uppercase UUID', () => {
      expect(isValidUUID('550E8400-E29B-41D4-A716-446655440000')).toBe(true)
    })

    it('rejects non-string input', () => {
      expect(isValidUUID(123)).toBe(false)
      expect(isValidUUID(null)).toBe(false)
      expect(isValidUUID(undefined)).toBe(false)
    })

    it('rejects invalid format', () => {
      expect(isValidUUID('not-a-uuid')).toBe(false)
      expect(isValidUUID('550e8400e29b41d4a716446655440000')).toBe(false)
      expect(isValidUUID('550e8400-e29b-41d4-a716')).toBe(false)
      expect(isValidUUID('')).toBe(false)
    })
  })

  describe('validateTargetUrl', () => {
    it('returns null for null/undefined input', () => {
      expect(validateTargetUrl(null)).toBeNull()
      expect(validateTargetUrl(undefined)).toBeNull()
      expect(validateTargetUrl('')).toBeNull()
    })

    it('accepts http URLs', () => {
      expect(validateTargetUrl('http://localhost')).toBeNull()
      expect(validateTargetUrl('http://127.0.0.1')).toBeNull()
    })

    it('accepts https URLs', () => {
      expect(validateTargetUrl('https://example.com')).toBeNull()
    })

    it('rejects non-http protocols', () => {
      expect(validateTargetUrl('ftp://example.com')).toBe(
        'Only http and https protocols are allowed for target URL',
      )
      expect(validateTargetUrl('file:///etc/passwd')).toBe(
        'Only http and https protocols are allowed for target URL',
      )
    })

    it('rejects invalid URL format', () => {
      expect(validateTargetUrl('not a url')).toBe('Invalid target URL format')
    })
  })

  describe('validateCustomHeaders', () => {
    it('returns null for null/undefined/non-object', () => {
      expect(validateCustomHeaders(null)).toBeNull()
      expect(validateCustomHeaders(undefined)).toBeNull()
      expect(validateCustomHeaders('string')).toBeNull()
    })

    it('accepts valid headers', () => {
      expect(
        validateCustomHeaders({ 'X-Custom': 'value', 'X-Api-Key': 'key123' }),
      ).toBeNull()
    })

    it('rejects too many headers', () => {
      const headers = {}
      for (let i = 0; i < 51; i++) {
        headers[`X-Header-${i}`] = 'value'
      }
      expect(validateCustomHeaders(headers)).toMatch(/Maximum 50/)
    })

    it('rejects empty header name', () => {
      expect(validateCustomHeaders({ '': 'value' })).toBe(
        'Header name cannot be empty',
      )
      expect(validateCustomHeaders({ '  ': 'value' })).toBe(
        'Header name cannot be empty',
      )
    })

    it('rejects header name exceeding max length', () => {
      const longName = 'X'.repeat(257)
      expect(validateCustomHeaders({ [longName]: 'value' })).toMatch(
        /exceeds maximum length/,
      )
    })

    it('rejects forbidden headers', () => {
      expect(validateCustomHeaders({ Host: 'evil.com' })).toMatch(
        /cannot be overridden/,
      )
      expect(validateCustomHeaders({ Authorization: 'Bearer x' })).toMatch(
        /cannot be overridden/,
      )
      expect(validateCustomHeaders({ Cookie: 'session=abc' })).toMatch(
        /cannot be overridden/,
      )
    })

    it('rejects non-string values', () => {
      expect(validateCustomHeaders({ 'X-Num': 123 })).toMatch(
        /value must be a string/,
      )
    })

    it('rejects header value exceeding max length', () => {
      const longValue = 'x'.repeat(8193)
      expect(validateCustomHeaders({ 'X-Long': longValue })).toMatch(
        /exceeds maximum length/,
      )
    })

    it('rejects CRLF injection in header name', () => {
      expect(validateCustomHeaders({ 'X-Bad\r\n': 'value' })).toMatch(
        /newline characters/,
      )
    })

    it('rejects CRLF injection in header value', () => {
      expect(validateCustomHeaders({ 'X-Good': 'val\r\nue' })).toMatch(
        /newline characters/,
      )
    })
  })

  describe('validateEndpoint', () => {
    it('requires name by default', () => {
      expect(validateEndpoint({})).toBe('Name is required')
      expect(validateEndpoint({ name: '' })).toBe('Name is required')
      expect(validateEndpoint({ name: '  ' })).toBe('Name is required')
    })

    it('accepts valid endpoint', () => {
      expect(validateEndpoint({ name: 'My Endpoint' })).toBeNull()
    })

    it('allows missing name when requireName is false', () => {
      expect(validateEndpoint({}, { requireName: false })).toBeNull()
    })

    it('still validates name if provided when requireName is false', () => {
      expect(validateEndpoint({ name: '' }, { requireName: false })).toBe(
        'Name is required',
      )
    })

    it('validates port range', () => {
      expect(validateEndpoint({ name: 'Test', target_port: 0 })).toBe(
        'Port must be between 1 and 65535',
      )
      expect(validateEndpoint({ name: 'Test', target_port: 70000 })).toBe(
        'Port must be between 1 and 65535',
      )
      expect(validateEndpoint({ name: 'Test', target_port: 3000 })).toBeNull()
    })

    it('validates timeout range', () => {
      expect(validateEndpoint({ name: 'Test', timeout_seconds: 0 })).toBe(
        'Timeout must be between 1 and 55 seconds',
      )
      expect(validateEndpoint({ name: 'Test', timeout_seconds: 60 })).toBe(
        'Timeout must be between 1 and 55 seconds',
      )
      expect(validateEndpoint({ name: 'Test', timeout_seconds: 30 })).toBeNull()
    })

    it('validates target_url', () => {
      expect(validateEndpoint({ name: 'Test', target_url: 'ftp://bad' })).toBe(
        'Only http and https protocols are allowed for target URL',
      )
    })

    it('validates custom_headers', () => {
      expect(
        validateEndpoint({
          name: 'Test',
          custom_headers: { Host: 'evil.com' },
        }),
      ).toMatch(/cannot be overridden/)
    })
  })
})
