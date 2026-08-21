import Foundation

/// 앱 → 위젯으로 전달되는 피드 스냅샷 (App Group UserDefaults).
/// 위젯은 이 스냅샷만으로 렌더한다 — 네트워크 호출·서버 값 재계산 없음 (design-concept 위젯 원칙).
struct FeedSnapshot: Codable {
    struct OptionRow: Codable {
        let label: String
        let count: Int
    }

    /// 축별 집계 — 표본 판정도 축별로 따른다 (rule-min-sample-display)
    struct Axis: Codable {
        /// 서버 visibleOptions 노출 순서 그대로 — 동수 순위의 안정 정렬 기준
        let rows: [OptionRow]
        let totalVotes: Int
        let sampleSufficient: Bool
    }

    let regionName: String
    let computedAt: Date
    let weather: Axis
    let temperature: Axis
}

/// 스냅샷 저장소 — RegionCache와 같은 App Group suite를 쓴다.
enum FeedSnapshotStore {
    private static let key = "feed.snapshot"

    private static var defaults: UserDefaults {
        UserDefaults(suiteName: AppEnvironment.appGroupId) ?? .standard
    }

    static func load() -> FeedSnapshot? {
        guard let data = defaults.data(forKey: key) else { return nil }
        return try? JSONDecoder().decode(FeedSnapshot.self, from: data)
    }

    static func save(_ snapshot: FeedSnapshot) {
        guard let data = try? JSONEncoder().encode(snapshot) else { return }
        defaults.set(data, forKey: key)
    }
}
