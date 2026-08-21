import Foundation

/// 낡음 정직 표기 "n분 전" — 홈·위젯 공용 (spec-weather-vote-widget Core Requirement 3).
enum Staleness {
    /// 위젯 타임라인 엔트리는 미래 시각 기준으로 미리 렌더되므로 now를 주입받는다.
    static func label(computedAt: Date, asOf now: Date = .now) -> String {
        let minutes = max(0, Int(now.timeIntervalSince(computedAt) / 60))
        if minutes == 0 { return "방금 전" }
        if minutes < 60 { return "\(minutes)분 전" }
        return "\(minutes / 60)시간 전"
    }
}
