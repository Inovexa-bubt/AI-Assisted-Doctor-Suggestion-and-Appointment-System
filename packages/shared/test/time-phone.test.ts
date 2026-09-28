import { describe, expect, it } from 'vitest'
import {
  addDays,
  daysBetween,
  dhakaDate,
  dhakaInstant,
  dhakaMinutes,
  formatPhone,
  fromMinutes,
  normalizePhone,
  toMinutes,
  weekdayOf,
} from '../src/index.ts'

describe('Dhaka time', () => {
  it('rolls over to the next date at 18:00 UTC', () => {
    expect(dhakaDate(new Date('2026-09-28T17:59:00Z'))).toBe('2026-09-28')
    expect(dhakaDate(new Date('2026-09-28T18:00:00Z'))).toBe('2026-09-29')
  })

  it('gives minutes since Dhaka midnight', () => {
    expect(dhakaMinutes(new Date('2026-09-28T11:30:00Z'))).toBe(17 * 60 + 30)
  })

  it('converts a Dhaka date and time to an instant and back', () => {
    const instant = dhakaInstant('2026-10-04', '17:30')
    expect(instant.toISOString()).toBe('2026-10-04T11:30:00.000Z')
    expect(dhakaDate(instant)).toBe('2026-10-04')
    expect(dhakaMinutes(instant)).toBe(toMinutes('17:30'))
  })

  it('does date arithmetic across month ends', () => {
    expect(addDays('2026-09-28', 5)).toBe('2026-10-03')
    expect(addDays('2026-10-01', -1)).toBe('2026-09-30')
    expect(daysBetween('2026-09-28', '2026-10-12')).toBe(14)
  })

  it('knows weekdays (0 = Sunday)', () => {
    expect(weekdayOf('2026-09-28')).toBe(1)
    expect(weekdayOf('2026-10-02')).toBe(5)
  })

  it('formats minutes as HH:mm', () => {
    expect(fromMinutes(9 * 60 + 5)).toBe('09:05')
    expect(fromMinutes(toMinutes('20:45'))).toBe('20:45')
  })
})

describe('normalizePhone', () => {
  it.each([
    ['01712345678', '01712345678'],
    ['01712-345678', '01712345678'],
    ['+8801712345678', '01712345678'],
    ['8801912345678', '01912345678'],
    ['০১৭১২৩৪৫৬৭৮', '01712345678'],
    [' 017 1234 5678 ', '01712345678'],
  ])('accepts %s', (input, expected) => {
    expect(normalizePhone(input)).toBe(expected)
  })

  it.each(['0171234567', '01212345678', '1712345678', '0171234567a', ''])('rejects %s', (input) => {
    expect(normalizePhone(input)).toBeNull()
  })

  it('formats for display', () => {
    expect(formatPhone('01712345678')).toBe('01712-345678')
  })
})
