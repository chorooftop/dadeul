import SwiftUI

/// 지역 확정 후의 홈 — 날씨 투표 카드, 크레딧, 큐레이션 주제 카드.
/// 스타일은 design/Main.dc.html 시안 기준 (specs/design-concept.md).
struct HomeView: View {
    let region: Components.Schemas.Region
    let onChangeRegion: () -> Void

    @State private var feed = FeedStore()

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                header

                switch feed.state {
                case .idle, .loading:
                    ProgressView("피드 불러오는 중…")
                        .font(DesignFont.body)
                        .padding(.top, 48)
                case .failed(let message):
                    Label(message, systemImage: "exclamationmark.triangle")
                        .font(DesignFont.caption)
                        .foregroundStyle(.red)
                        .padding(.top, 48)
                case .loaded:
                    weatherCard
                    walletRow
                    ForEach(feed.topics) { entry in
                        topicCard(entry)
                    }
                }

                if let message = feed.voteErrorMessage {
                    Label(message, systemImage: "exclamationmark.bubble")
                        .font(DesignFont.caption)
                        .foregroundStyle(.orange)
                }
            }
            .padding(20)
        }
        .background(DesignToken.bg.ignoresSafeArea())
        .task { await feed.load(regionCode: region.code) }
        .refreshable { await feed.load(regionCode: region.code) }
    }

    private var header: some View {
        HStack(alignment: .top, spacing: 12) {
            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: 7) {
                    Circle()
                        .fill(DesignToken.sky)
                        .frame(width: 8, height: 8)
                    Text(region.name)
                        .font(DesignFont.screenTitle)
                        .foregroundStyle(DesignToken.ink)
                }
                Text(region.fullName)
                    .font(DesignFont.caption)
                    .foregroundStyle(DesignToken.inkSub)
            }
            Spacer()
            Button(action: onChangeRegion) {
                Text("동네 바꾸기")
                    .font(DesignFont.caption)
                    .foregroundStyle(DesignToken.ink)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 8)
                    .background(DesignToken.surface, in: Capsule())
                    .overlay(Capsule().stroke(DesignToken.stroke, lineWidth: 1))
            }
            .buttonStyle(.plain)
        }
    }

    // MARK: - 날씨 투표 카드

    private var weatherCard: some View {
        VStack(alignment: .leading, spacing: 13) {
            HStack(alignment: .firstTextBaseline) {
                Text("지금 날씨 어때?")
                    .font(DesignFont.cardTitle)
                    .foregroundStyle(DesignToken.ink)
                Spacer()
                if let computedAt = feed.weatherTally?.computedAt {
                    Text(Self.staleness(computedAt))
                        .font(DesignFont.captionSmall)
                        .foregroundStyle(DesignToken.inkTer)
                }
            }
            // 2축 안내 — 축별 1개 선택 (term-weather-option, term-temperature-option)
            Text("날씨 하나, 온도 하나 — 느껴지는 대로 골라 주세요")
                .font(DesignFont.caption)
                .foregroundStyle(DesignToken.inkSub)

            // 노출 선택지는 서버 visibleOptions만 신뢰 (term-weather-option)
            optionChips(
                labels: feed.visibleOptions.map { WeatherOptionDisplay.label(for: $0.rawValue) },
                isSelected: { index in
                    feed.weatherMyVote?.optionValue == feed.visibleOptions[index].rawValue
                },
                action: { index in
                    Task { await feed.castWeatherVote(feed.visibleOptions[index]) }
                }
            )

            if let tally = feed.weatherTally {
                tallyView(tally)
            }

            Rectangle()
                .fill(DesignToken.stroke)
                .frame(height: 1)

            // 온도 축 — 날씨 축과 독립 집계 (term-temperature-option)
            Text("체감 온도는 어때요?")
                .font(DesignFont.bold(16))
                .foregroundStyle(DesignToken.ink)
            optionChips(
                labels: feed.temperatureOptions.map { TemperatureOptionDisplay.label(for: $0.rawValue) },
                isSelected: { index in
                    feed.temperatureMyVote?.optionValue == feed.temperatureOptions[index].rawValue
                },
                action: { index in
                    Task { await feed.castTemperatureVote(feed.temperatureOptions[index]) }
                }
            )
            if let tally = feed.temperatureTally {
                temperatureTallyView(tally)
            }

            if feed.weatherMyVote != nil {
                VStack(alignment: .leading, spacing: 0) {
                    Rectangle()
                        .fill(DesignToken.stroke)
                        .frame(height: 1)
                    // "신선한 신호"(rule-credit-grant)는 내부 용어 — 사용자 문구로 풀어쓴다
                    Text("언제든 바꿀 수 있어요 — 크레딧은 새로 참여할 때만 적립돼요")
                        .font(DesignFont.captionSmall)
                        .foregroundStyle(DesignToken.inkTer)
                        .padding(.top, 11)
                }
            }
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(DesignToken.surface, in: RoundedRectangle(cornerRadius: 20))
        .overlay(RoundedRectangle(cornerRadius: 20).stroke(DesignToken.stroke, lineWidth: 1))
    }

    // 선택 칩 행 — 시안: 텍스트 칩, 선택 시 sky-tint 배경 + sky 보더 (design/Main.dc.html)
    private func optionChips(
        labels: [String],
        isSelected: @escaping (Int) -> Bool,
        action: @escaping (Int) -> Void
    ) -> some View {
        FlowLayout(spacing: 8) {
            ForEach(labels.indices, id: \.self) { index in
                let selected = isSelected(index)
                Button {
                    action(index)
                } label: {
                    Text(labels[index])
                        .font(selected ? DesignFont.bold(14) : DesignFont.body)
                        .foregroundStyle(selected ? DesignToken.sky : DesignToken.ink)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 9)
                        .background(
                            selected ? DesignToken.skyTint : DesignToken.surface,
                            in: RoundedRectangle(cornerRadius: 12)
                        )
                        .overlay(
                            RoundedRectangle(cornerRadius: 12)
                                .stroke(
                                    selected ? DesignToken.sky : DesignToken.stroke,
                                    lineWidth: selected ? 1.5 : 1
                                )
                        )
                }
                .buttonStyle(.plain)
            }
        }
    }

    // MARK: - 집계 (개표 현황 스타일 — 순위 뱃지·득표 바·표수 병기)

    private struct RankedOption {
        let rank: Int
        let label: String
        let count: Int
        let ratio: Double
    }

    private static func ranked(labels: [(label: String, value: String)], tally: Components.Schemas.Tally) -> [RankedOption] {
        let counted = labels.map { item in
            (label: item.label, count: tally.counts.additionalProperties[item.value] ?? 0)
        }
        // 동수는 서버 노출 순서 유지 — 정렬 안정성에 의존
        let sorted = counted.enumerated().sorted { lhs, rhs in
            lhs.element.count != rhs.element.count
                ? lhs.element.count > rhs.element.count
                : lhs.offset < rhs.offset
        }
        return sorted.enumerated().map { rank, item in
            RankedOption(
                rank: rank + 1,
                label: item.element.label,
                count: item.element.count,
                ratio: tally.totalVotes > 0 ? Double(item.element.count) / Double(tally.totalVotes) : 0
            )
        }
    }

    private func rankedRow(_ option: RankedOption) -> some View {
        let isTop = option.rank == 1
        return HStack(spacing: 8) {
            Text("\(option.rank)")
                .font(DesignFont.bold(11))
                .foregroundStyle(isTop ? DesignToken.surface : DesignToken.inkSub)
                .frame(width: 18, height: 18)
                .background(isTop ? DesignToken.sky : DesignToken.stroke, in: Circle())
            Text(option.label)
                .font(isTop ? DesignFont.bold(14) : DesignFont.body)
                .foregroundStyle(DesignToken.ink)
                .frame(width: 52, alignment: .leading)
            tallyBar(ratio: option.ratio, isTop: isTop)
            Text(option.ratio.formatted(.percent.precision(.fractionLength(0))))
                .font(isTop ? DesignFont.extraBold(15) : DesignFont.bold(14))
                .monospacedDigit()
                .foregroundStyle(isTop ? DesignToken.sky : DesignToken.inkSub)
                .frame(width: 44, alignment: .trailing)
            Text("\(option.count)표")
                .font(DesignFont.captionSmall)
                .monospacedDigit()
                .foregroundStyle(DesignToken.inkTer)
                .frame(width: 30, alignment: .trailing)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 6)
        .background(
            isTop ? DesignToken.skyTint : Color.clear,
            in: RoundedRectangle(cornerRadius: 10)
        )
        .padding(.horizontal, -8)
    }

    private func tallyBar(ratio: Double, isTop: Bool) -> some View {
        GeometryReader { proxy in
            ZStack(alignment: .leading) {
                Capsule()
                    .fill(isTop ? DesignToken.surface : DesignToken.stroke)
                Capsule()
                    .fill(isTop ? DesignToken.sky : DesignToken.inkTer)
                    .frame(width: proxy.size.width * ratio)
            }
        }
        .frame(height: 6)
        .frame(maxWidth: .infinity)
    }

    private func rankedTally(
        labels: [(label: String, value: String)],
        tally: Components.Schemas.Tally,
        participants: String
    ) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            ForEach(Self.ranked(labels: labels, tally: tally), id: \.rank) { option in
                rankedRow(option)
            }
            Text(participants)
                .font(DesignFont.captionSmall)
                .foregroundStyle(DesignToken.inkTer)
        }
    }

    @ViewBuilder
    private func tallyView(_ tally: Components.Schemas.Tally) -> some View {
        // 표본 판정은 서버 sampleSufficient만 따른다 (rule-min-sample-display)
        if tally.sampleSufficient {
            rankedTally(
                labels: feed.visibleOptions.map { (WeatherOptionDisplay.label(for: $0.rawValue), $0.rawValue) },
                tally: tally,
                participants: "최근 2시간 · \(tally.totalVotes)명 참여"
            )
        } else {
            // 0명일 때만 "첫 투표" — 참여가 있는데 첫 투표를 기다린다는 모순 방지
            Label(
                tally.totalVotes == 0
                    ? "현재 위치의 첫 투표를 기다려요"
                    : "지금까지 \(tally.totalVotes)명 참여 — 5명이 모이면 결과가 보여요",
                systemImage: "sparkles"
            )
            .font(DesignFont.body)
            .foregroundStyle(DesignToken.ink)
            .tint(DesignToken.amber)
            .symbolRenderingMode(.multicolor)
        }
    }

    // 온도 축 집계 — 표본 판정도 축별 (rule-min-sample-display)
    @ViewBuilder
    private func temperatureTallyView(_ tally: Components.Schemas.Tally) -> some View {
        if tally.sampleSufficient {
            rankedTally(
                labels: feed.temperatureOptions.map { (TemperatureOptionDisplay.label(for: $0.rawValue), $0.rawValue) },
                tally: tally,
                participants: "최근 2시간 · \(tally.totalVotes)명 참여"
            )
        } else if tally.totalVotes > 0 {
            Text("온도 투표 \(tally.totalVotes)명 — 5명이 모이면 결과가 보여요")
                .font(DesignFont.caption)
                .foregroundStyle(DesignToken.inkSub)
        }
    }

    // MARK: - 크레딧

    @ViewBuilder
    private var walletRow: some View {
        if let wallet = feed.wallet {
            HStack(spacing: 8) {
                Circle()
                    .fill(DesignToken.amber)
                    .frame(width: 12, height: 12)
                Text("크레딧 \(wallet.balance)")
                    .font(DesignFont.bold(14))
                    .foregroundStyle(DesignToken.ink)
                Spacer()
                Text("오늘 적립 \(wallet.dailyEarned)/\(wallet.dailyCap)")
                    .font(DesignFont.caption)
                    .foregroundStyle(DesignToken.inkSub)
            }
            .padding(.horizontal, 4)
        }
    }

    // MARK: - 큐레이션 주제 카드

    private func topicCard(_ entry: FeedStore.TopicEntry) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(entry.topic.title)
                .font(DesignFont.cardTitle)
                .foregroundStyle(DesignToken.ink)

            ForEach(entry.topic.options, id: \.value) { option in
                let isMyVote = entry.myVote?.optionValue == option.value
                let count = entry.tally.counts.additionalProperties[option.value] ?? 0
                Button {
                    Task { await feed.castCuratedVote(topicId: entry.topic.id, optionValue: option.value) }
                } label: {
                    HStack(spacing: 8) {
                        if let emoji = option.emoji { Text(emoji) }
                        Text(option.label)
                            .font(isMyVote ? DesignFont.bold(14) : DesignFont.body)
                            .foregroundStyle(isMyVote ? DesignToken.sky : DesignToken.ink)
                        if isMyVote {
                            Image(systemName: "checkmark.circle.fill")
                                .font(.system(size: 14))
                                .foregroundStyle(DesignToken.sky)
                        }
                        Spacer()
                        Text("\(count)표")
                            .font(DesignFont.captionSmall)
                            .monospacedDigit()
                            .foregroundStyle(DesignToken.inkTer)
                    }
                    .padding(.vertical, 9)
                    .padding(.horizontal, 12)
                    .background(
                        isMyVote ? DesignToken.skyTint : DesignToken.surface,
                        in: RoundedRectangle(cornerRadius: 12)
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .stroke(
                                isMyVote ? DesignToken.sky : DesignToken.stroke,
                                lineWidth: isMyVote ? 1.5 : 1
                            )
                    )
                }
                .buttonStyle(.plain)
            }

            Text("\(entry.tally.totalVotes)명 참여")
                .font(DesignFont.captionSmall)
                .foregroundStyle(DesignToken.inkTer)
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(DesignToken.surface, in: RoundedRectangle(cornerRadius: 20))
        .overlay(RoundedRectangle(cornerRadius: 20).stroke(DesignToken.stroke, lineWidth: 1))
    }

    // MARK: - 낡음 정직 표기 (spec-weather-vote-widget Core Requirement 3)

    static func staleness(_ computedAt: Date) -> String {
        let minutes = max(0, Int(Date().timeIntervalSince(computedAt) / 60))
        if minutes == 0 { return "방금 전" }
        if minutes < 60 { return "\(minutes)분 전" }
        return "\(minutes / 60)시간 전"
    }
}

/// 칩 줄바꿈 레이아웃 — 선택지 수가 늘어도 (월 가변 6종) 행을 넘겨 배치한다.
struct FlowLayout: Layout {
    var spacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let rows = computeRows(proposal: proposal, subviews: subviews)
        let height = rows.map { $0.height }.reduce(0, +) + spacing * CGFloat(max(0, rows.count - 1))
        return CGSize(width: proposal.width ?? 0, height: height)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var y = bounds.minY
        for row in computeRows(proposal: proposal, subviews: subviews) {
            var x = bounds.minX
            for index in row.indices {
                let size = subviews[index].sizeThatFits(.unspecified)
                subviews[index].place(at: CGPoint(x: x, y: y), proposal: .unspecified)
                x += size.width + spacing
            }
            y += row.height + spacing
        }
    }

    private struct Row {
        var indices: [Int] = []
        var height: CGFloat = 0
    }

    private func computeRows(proposal: ProposedViewSize, subviews: Subviews) -> [Row] {
        let maxWidth = proposal.width ?? .infinity
        var rows: [Row] = []
        var current = Row()
        var x: CGFloat = 0
        for (index, subview) in subviews.enumerated() {
            let size = subview.sizeThatFits(.unspecified)
            if x + size.width > maxWidth, !current.indices.isEmpty {
                rows.append(current)
                current = Row()
                x = 0
            }
            current.indices.append(index)
            current.height = max(current.height, size.height)
            x += size.width + spacing
        }
        if !current.indices.isEmpty { rows.append(current) }
        return rows
    }
}
