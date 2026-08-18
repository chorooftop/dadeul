import { describe, expect, it } from 'vitest'
import {
  isSubmittableWeatherOption,
  kstMonth,
  visibleWeatherOptions,
} from '../src/domain/weather-options.js'

describe('날씨선택지 월 가변 규칙 (term-weather-option)', () => {
  const august = new Date('2026-08-15T03:00:00Z')
  const january = new Date('2026-01-15T03:00:00Z')

  it('8월엔 눈이 숨겨지고 5종만 노출된다', () => {
    const values = visibleWeatherOptions(august).map((option) => option.value)
    expect(values).toEqual(['sunny', 'cloudy', 'rain', 'wind', 'fog'])
  })

  it('1월엔 6종 전부 노출된다', () => {
    const values = visibleWeatherOptions(january).map((option) => option.value)
    expect(values).toContain('snow')
    expect(values).toHaveLength(6)
  })

  it('숨김 월의 선택지는 신규 제출이 거부된다', () => {
    expect(isSubmittableWeatherOption('snow', august)).toBe(false)
    expect(isSubmittableWeatherOption('snow', january)).toBe(true)
    expect(isSubmittableWeatherOption('rain', august)).toBe(true)
  })

  it('KST 월 경계 — UTC 말일 15시 이후는 KST 다음 달이다', () => {
    expect(kstMonth(new Date('2026-10-31T14:59:00Z'))).toBe(10)
    expect(kstMonth(new Date('2026-10-31T15:00:00Z'))).toBe(11)
  })
})
