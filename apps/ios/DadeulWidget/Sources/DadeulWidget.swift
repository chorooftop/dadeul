import SwiftUI
import WidgetKit

struct FeedEntry: TimelineEntry {
    let date: Date
    let regionName: String
    let topOptionLabel: String
    let topOptionRatio: Int
}

struct FeedTimelineProvider: TimelineProvider {
    // 30분 주기 갱신 — spec-weather-vote-widget Core Requirement 4
    static let refreshInterval: TimeInterval = 30 * 60

    static let placeholderEntry = FeedEntry(
        date: .now,
        regionName: "우리 동네",
        topOptionLabel: "맑음",
        topOptionRatio: 0
    )

    func placeholder(in context: Context) -> FeedEntry {
        Self.placeholderEntry
    }

    func getSnapshot(in context: Context, completion: @escaping (FeedEntry) -> Void) {
        completion(Self.placeholderEntry)
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<FeedEntry>) -> Void) {
        // 계획 6단계에서 App Group(AppEnvironment.appGroupId)의 피드 스냅샷을 읽도록 교체한다.
        let entry = Self.placeholderEntry
        let next = entry.date.addingTimeInterval(Self.refreshInterval)
        completion(Timeline(entries: [entry], policy: .after(next)))
    }
}

struct DadeulWidgetEntryView: View {
    var entry: FeedEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(entry.regionName)
                .font(.caption)
                .foregroundStyle(.secondary)
            Text(entry.topOptionLabel)
                .font(.headline)
            Text("현재 위치의 첫 투표를 기다려요")
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .containerBackground(.fill.tertiary, for: .widget)
    }
}

struct DadeulWidget: Widget {
    let kind = "DadeulFeedWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: FeedTimelineProvider()) { entry in
            DadeulWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("다들")
        .description("우리 동네의 지금을 투표 집계로 보여줘요.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}
