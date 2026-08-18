// term-weather-option — 6종 풀 + 월 기반 자동 노출 규칙 (specs/atoms/term/날씨선택지.md가 진실)
// 노출 판정은 서버 KST 월 기준, 운영자 개입 없음

export const WEATHER_TOPIC_ID = 'weather'

export interface WeatherOptionDef {
  value: string
  label: string
  emoji: string
  visibleMonths: readonly number[] // KST 월 (1~12)
}

const ALL_MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const
const SNOW_MONTHS = [11, 12, 1, 2, 3] as const

export const WEATHER_OPTIONS: readonly WeatherOptionDef[] = [
  { value: 'sunny', label: '맑음', emoji: '☀️', visibleMonths: ALL_MONTHS },
  { value: 'cloudy', label: '흐림', emoji: '☁️', visibleMonths: ALL_MONTHS },
  { value: 'rain', label: '비', emoji: '☔', visibleMonths: ALL_MONTHS },
  { value: 'wind', label: '바람', emoji: '🌬️', visibleMonths: ALL_MONTHS },
  { value: 'fog', label: '안개', emoji: '🌫️', visibleMonths: ALL_MONTHS },
  { value: 'snow', label: '눈', emoji: '❄️', visibleMonths: SNOW_MONTHS },
]

export function kstMonth(now: Date): number {
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  return kst.getUTCMonth() + 1
}

export function visibleWeatherOptions(now: Date): WeatherOptionDef[] {
  const month = kstMonth(now)
  return WEATHER_OPTIONS.filter((option) => option.visibleMonths.includes(month))
}

// 신규 제출만 노출 월 기준으로 검증한다 — 기존 표는 숨김 월에도 유효 (윈도우 자연 소멸)
export function isSubmittableWeatherOption(value: string, now: Date): boolean {
  return visibleWeatherOptions(now).some((option) => option.value === value)
}
