import { describe, it, expect } from 'vitest'
import { validateCalendarUrl } from '@/lib/mba/sync-calendar'

describe('validateCalendarUrl (SSRF guard)', () => {
  it('accepts a public https feed', () => {
    const r = validateCalendarUrl('https://lms.example.ac.za/d2l/le/calendar/feed/user/feed.ics?token=abc')
    expect('url' in r).toBe(true)
  })

  it('accepts webcal:// links (Outlook) as https', () => {
    const r = validateCalendarUrl('webcal://outlook.office365.com/owa/calendar/abc/reachcalendar.ics')
    expect('url' in r && r.url.protocol).toBe('https:')
  })

  it.each([
    ['http://lms.example.ac.za/feed.ics', 'https'],
    ['not a url', 'valid'],
    ['https://localhost/feed.ics', 'public'],
    ['https://127.0.0.1/feed.ics', 'public'],
    ['https://10.0.0.5/feed.ics', 'public'],
    ['https://[::1]/feed.ics', 'public'],
    ['https://intranet/feed.ics', 'public'],
    ['https://box.internal/feed.ics', 'public'],
  ])('rejects %s', (url, word) => {
    const r = validateCalendarUrl(url)
    expect('error' in r && r.error.toLowerCase()).toContain(word)
  })
})
