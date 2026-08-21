import SwiftUI
import WidgetKit

struct FeedEntry: TimelineEntry {
    let date: Date
    /// nil이면 앱이 아직 스냅샷을 저장한 적 없음 (최초 설치 직후)
    let snapshot: FeedSnapshot?
}

struct FeedTimelineProvider: TimelineProvider {
    /// 30분 주기 갱신 — spec-weather-vote-widget Core Requirement 4
    static let refreshInterval: TimeInterval = 30 * 60
    /// "n분 전" 낡음 표기를 네트워크 없이 갱신하는 엔트리 간격.
    /// 타임라인 예산은 리로드에만 소모되므로 엔트리를 미리 깔아 두는 건 무료다.
    static let entryStride: TimeInterval = 5 * 60

    /// 위젯 갤러리 미리보기 — 시안 WidgetSmall/WidgetMedium 수치 그대로
    static func placeholderSnapshot(now: Date) -> FeedSnapshot {
        FeedSnapshot(
            regionName: "강남구",
            computedAt: now.addingTimeInterval(-12 * 60),
            weather: FeedSnapshot.Axis(
                rows: [
                    FeedSnapshot.OptionRow(label: "맑음", count: 3),
                    FeedSnapshot.OptionRow(label: "흐림", count: 2),
                    FeedSnapshot.OptionRow(label: "비", count: 0),
                    FeedSnapshot.OptionRow(label: "바람", count: 0),
                ],
                totalVotes: 5,
                sampleSufficient: true
            ),
            temperature: FeedSnapshot.Axis(
                rows: [
                    FeedSnapshot.OptionRow(label: "더움", count: 7),
                    FeedSnapshot.OptionRow(label: "따뜻함", count: 2),
                    FeedSnapshot.OptionRow(label: "시원함", count: 1),
                    FeedSnapshot.OptionRow(label: "추움", count: 0),
                ],
                totalVotes: 10,
                sampleSufficient: true
            )
        )
    }

    func placeholder(in context: Context) -> FeedEntry {
        let now = Date()
        return FeedEntry(date: now, snapshot: Self.placeholderSnapshot(now: now))
    }

    func getSnapshot(in context: Context, completion: @escaping (FeedEntry) -> Void) {
        let now = Date()
        let snapshot = FeedSnapshotStore.load()
            ?? (context.isPreview ? Self.placeholderSnapshot(now: now) : nil)
        completion(FeedEntry(date: now, snapshot: snapshot))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<FeedEntry>) -> Void) {
        let snapshot = FeedSnapshotStore.load()
        let now = Date()
        // 같은 스냅샷으로 5분 간격 엔트리를 깔아 "n분 전" 표기만 굴린다
        let entries = stride(from: 0, through: Self.refreshInterval, by: Self.entryStride).map { offset in
            FeedEntry(date: now.addingTimeInterval(offset), snapshot: snapshot)
        }
        let policy: TimelineReloadPolicy = .after(now.addingTimeInterval(Self.refreshInterval))
        completion(Timeline(entries: entries, policy: policy))
    }
}

struct DadeulWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: AppEnvironment.widgetKind, provider: FeedTimelineProvider()) { entry in
            FeedWidgetEntryView(entry: entry)
                .containerBackground(DesignToken.surface, for: .widget)
        }
        .configurationDisplayName("다들")
        .description("현재 위치의 지금을 투표 집계로 보여줘요.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}
