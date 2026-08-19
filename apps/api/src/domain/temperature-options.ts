// term-temperature-option — 날씨 주제의 온도 축 4종, 상시 노출 (specs/atoms/term/온도선택지.md가 진실)
// 축 추론은 주제 스코프 안에서만 수행한다 — 큐레이션 주제의 동명 옵션과 충돌하지 않는다

export type VoteAxis = 'primary' | 'temperature'

export interface TemperatureOptionDef {
  value: string
  label: string
}

export const TEMPERATURE_OPTIONS: readonly TemperatureOptionDef[] = [
  { value: 'hot', label: '더움' },
  { value: 'warm', label: '따뜻함' },
  { value: 'cool', label: '시원함' },
  { value: 'cold', label: '추움' },
]

export function isTemperatureOption(value: string): boolean {
  return TEMPERATURE_OPTIONS.some((option) => option.value === value)
}

// 날씨 주제 전용 — optionValue로 축을 추론한다 (action-vote-cast Execution Order 3)
export function resolveWeatherAxis(optionValue: string): VoteAxis {
  return isTemperatureOption(optionValue) ? 'temperature' : 'primary'
}
