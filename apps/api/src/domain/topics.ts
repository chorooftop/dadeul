// 주제 개폐 판정의 단일 정의 — 피드 노출과 투표 허용이 어긋나면
// "보이는데 투표하면 거부되는" 상태가 생긴다 (votes.ts·feed.ts 공용)
interface TopicOpenFields {
  status: 'scheduled' | 'active' | 'closed'
  openAt: Date | null
  closeAt: Date | null
}

export function isTopicOpen(topic: TopicOpenFields, now: Date): boolean {
  if (topic.status !== 'active') {
    return false
  }
  if (topic.openAt !== null && topic.openAt > now) {
    return false
  }
  if (topic.closeAt !== null && topic.closeAt <= now) {
    return false
  }
  return true
}
