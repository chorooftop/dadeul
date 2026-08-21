import SwiftUI
import WidgetKit

/// 위젯 뷰 — design/ 캔버스 WidgetSmall(표본 충족)·WidgetSmallEmpty(미달)·WidgetMedium(온도 병기) 기준.
/// 개표 현황 스타일: 순위 뱃지 + 라벨 + 득표 바 + 굵은 %. 아이콘은 SF Symbol만 (이모지 금지).
struct FeedWidgetEntryView: View {
    @Environment(\.widgetFamily) private var family

    let entry: FeedEntry

    var body: some View {
        if let snapshot = entry.snapshot, snapshot.weather.sampleSufficient {
            switch family {
            case .systemMedium:
                MediumFeedView(snapshot: snapshot, asOf: entry.date)
            default:
                SmallFeedView(snapshot: snapshot, asOf: entry.date)
            }
        } else {
            // 표본 미달·스냅샷 없음 — 참여 유도가 기본 경험 (Core Requirement 8)
            EmptyFeedView(snapshot: entry.snapshot, asOf: entry.date)
        }
    }
}

// MARK: - 순위 계산 (서버 counts만 사용, 재계산 없음)

struct RankedRow: Identifiable {
    let rank: Int
    let label: String
    let count: Int
    let ratio: Double
    var id: Int { rank }
}

func rankedRows(_ axis: FeedSnapshot.Axis) -> [RankedRow] {
    // 동수는 서버 노출 순서 유지 — HomeView와 같은 안정 정렬
    let sorted = axis.rows.enumerated().sorted { lhs, rhs in
        lhs.element.count != rhs.element.count
            ? lhs.element.count > rhs.element.count
            : lhs.offset < rhs.offset
    }
    return sorted.enumerated().map { rank, item in
        RankedRow(
            rank: rank + 1,
            label: item.element.label,
            count: item.element.count,
            ratio: axis.totalVotes > 0 ? Double(item.element.count) / Double(axis.totalVotes) : 0
        )
    }
}

func percentText(_ ratio: Double) -> String {
    "\(Int((ratio * 100).rounded()))%"
}

// MARK: - 공용 조각

/// 지역명 + 라이브 닷 — 상단 고정 (design-concept 위젯 원칙)
struct WidgetHeader: View {
    let regionName: String
    let dotColor: Color
    var trailing: String?

    var body: some View {
        HStack(spacing: 5) {
            Circle()
                .fill(dotColor)
                .frame(width: 6, height: 6)
            Text(regionName)
                .font(DesignFont.extraBold(13))
                .foregroundStyle(DesignToken.ink)
            if let trailing {
                Spacer()
                Text(trailing)
                    .font(DesignFont.regular(10))
                    .foregroundStyle(DesignToken.inkTer)
            }
        }
    }
}

/// 개표 행 — 순위 뱃지 + 라벨 + 득표 바 + %. 1위는 sky 강조 + sky-tint 하이라이트
struct TallyRankRow: View {
    let row: RankedRow
    var showCount = false

    private var isTop: Bool { row.rank == 1 }

    var body: some View {
        HStack(spacing: 5) {
            Text("\(row.rank)")
                .font(DesignFont.bold(9))
                .foregroundStyle(isTop ? DesignToken.surface : DesignToken.inkSub)
                .frame(width: 14, height: 14)
                .background(isTop ? DesignToken.sky : DesignToken.stroke, in: Circle())
            Text(row.label)
                .font(isTop ? DesignFont.bold(12) : DesignFont.medium(12))
                .foregroundStyle(DesignToken.ink)
                .frame(width: 30, alignment: .leading)
                .lineLimit(1)
            GeometryReader { proxy in
                ZStack(alignment: .leading) {
                    Capsule()
                        .fill(isTop ? DesignToken.surface : DesignToken.stroke)
                    Capsule()
                        .fill(isTop ? DesignToken.sky : DesignToken.inkTer)
                        .frame(width: proxy.size.width * row.ratio)
                }
            }
            .frame(height: 5)
            Text(percentText(row.ratio))
                .font(isTop ? DesignFont.extraBold(12) : DesignFont.bold(12))
                .monospacedDigit()
                .foregroundStyle(isTop ? DesignToken.sky : DesignToken.inkSub)
                .frame(width: 32, alignment: .trailing)
            if showCount {
                Text("\(row.count)표")
                    .font(DesignFont.regular(10))
                    .monospacedDigit()
                    .foregroundStyle(DesignToken.inkTer)
                    .frame(width: 24, alignment: .trailing)
            }
        }
        .padding(.horizontal, 5)
        .padding(.vertical, 3)
        .background(isTop ? DesignToken.skyTint : Color.clear, in: RoundedRectangle(cornerRadius: 7))
        .padding(.horizontal, -5)
    }
}

/// 체감 병기 행 — 온도 축 1위 ("체감 더움 70%"). 축별 표본 판정이라 미달이면 행 자체를 숨긴다
struct TemperatureLine: View {
    let axis: FeedSnapshot.Axis
    var trailing: String?

    var body: some View {
        if axis.sampleSufficient, let top = rankedRows(axis).first {
            HStack(spacing: 4) {
                Text("체감")
                    .font(DesignFont.regular(10))
                    .foregroundStyle(DesignToken.inkSub)
                Text("\(top.label) \(percentText(top.ratio))")
                    .font(DesignFont.bold(11))
                    .foregroundStyle(DesignToken.sky)
                if let trailing {
                    Spacer()
                    Text(trailing)
                        .font(DesignFont.regular(10))
                        .foregroundStyle(DesignToken.inkTer)
                }
            }
        }
    }
}

/// "n명 참여 · n분 전" — 하단 고정 (낡음 정직 표기, Core Requirement 3)
struct WidgetFooter: View {
    let text: String

    var body: some View {
        Text(text)
            .font(DesignFont.regular(9))
            .foregroundStyle(DesignToken.inkTer)
    }
}

// MARK: - Small (WidgetSmall 아트보드)

struct SmallFeedView: View {
    let snapshot: FeedSnapshot
    let asOf: Date

    var body: some View {
        VStack(alignment: .leading, spacing: 7) {
            WidgetHeader(regionName: snapshot.regionName, dotColor: DesignToken.sky)
            ForEach(rankedRows(snapshot.weather).prefix(3)) { row in
                TallyRankRow(row: row)
            }
            TemperatureLine(axis: snapshot.temperature)
            Spacer(minLength: 0)
            WidgetFooter(
                text: "\(snapshot.weather.totalVotes)명 참여 · \(Staleness.label(computedAt: snapshot.computedAt, asOf: asOf))"
            )
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
}

// MARK: - Medium (WidgetMedium 아트보드)

struct MediumFeedView: View {
    let snapshot: FeedSnapshot
    let asOf: Date

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            WidgetHeader(
                regionName: snapshot.regionName,
                dotColor: DesignToken.sky,
                trailing: "실시간 날씨 투표"
            )
            ForEach(rankedRows(snapshot.weather).prefix(4)) { row in
                TallyRankRow(row: row, showCount: true)
            }
            TemperatureLine(
                axis: snapshot.temperature,
                trailing: "온도 투표 \(snapshot.temperature.totalVotes)명"
            )
            Spacer(minLength: 0)
            WidgetFooter(
                text: "\(snapshot.weather.totalVotes)명 참여 · \(Staleness.label(computedAt: snapshot.computedAt, asOf: asOf))"
            )
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
}

// MARK: - 표본 미달·스냅샷 없음 (WidgetSmallEmpty 아트보드)

struct EmptyFeedView: View {
    /// nil이면 앱이 한 번도 스냅샷을 저장하지 않은 상태
    let snapshot: FeedSnapshot?
    let asOf: Date

    /// 2단계 문구 — 참여가 있는데 "첫 투표"를 쓰지 않는다 (2026-08-21 교정)
    private var message: String {
        (snapshot?.weather.totalVotes ?? 0) == 0
            ? "현재 위치의\n첫 투표를 기다려요"
            : "5명이 모이면\n결과가 보여요"
    }

    private var footer: String? {
        guard let snapshot else { return nil }
        let staleness = Staleness.label(computedAt: snapshot.computedAt, asOf: asOf)
        return snapshot.weather.totalVotes > 0
            ? "지금까지 \(snapshot.weather.totalVotes)명 · \(staleness)"
            : staleness
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            WidgetHeader(regionName: snapshot?.regionName ?? "다들", dotColor: DesignToken.amber)
            Image(systemName: "sparkle")
                .font(.system(size: 18))
                .foregroundStyle(DesignToken.amber)
                .padding(.top, 4)
            Text(message)
                .font(DesignFont.bold(13))
                .foregroundStyle(DesignToken.ink)
                .lineSpacing(3)
            Spacer(minLength: 0)
            if let footer {
                WidgetFooter(text: footer)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
}
