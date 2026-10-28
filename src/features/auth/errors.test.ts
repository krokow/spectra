import { describe, expect, it } from 'vitest'
import { AuthFailure } from './api'
import { authErrorKey } from './errors'

describe('authErrorKey', () => {
  it.each([
    [new AuthFailure('invalid_code'), 'invalid_code'],
    [{ message: 'Trop de tentatives, réessaie dans un moment.', code: 'PT429' }, 'rate_limited'],
    [
      { message: 'Invalid login credentials', status: 400, code: 'invalid_credentials' },
      'invalid_credentials',
    ],
    [{ message: 'User already registered', code: 'user_already_exists' }, 'email_taken'],
    [{ message: 'Database error saving new user' }, 'username_taken'],
    [new TypeError('Failed to fetch'), 'network'],
    ['n’importe quoi', 'unknown'],
  ])('%o → %s', (err, key) => {
    expect(authErrorKey(err)).toBe(key)
  })
})
