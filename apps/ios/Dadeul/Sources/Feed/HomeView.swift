import SwiftUI

/// 지역 확정 후의 홈 — 날씨 투표 카드, 크레딧, 큐레이션 주제 카드.
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
                        .padding(.top, 48)
                case .failed(let message):
                    Label(message, systemImage: "exclamationmark.triangle")
                        .font(.footnote)
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
                        .font(.footnote)
                        .foregroundStyle(.orange)
                }
            }
            .padding()
        }
        .task { await feed.load(regionCode: region.code) }
        .refreshable { await feed.load(regionCode: region.code) }
    }

    private var header: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Label(region.name, systemImage: "mappin.and.ellipse")
                    .font(.title2.bold())
                Text(region.fullName)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            Button("동네 바꾸기", action: onChangeRegion)
                .font(.caption)
        }
    }

    // MARK: - 날씨 투표 카드

    private var weatherCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("지금 날씨 어때?")
                .font(.headline)

            // 노출 선택지는 서버 visibleOptions만 신뢰 (term-weather-option)
            HStack(spacing: 8) {
                ForEach(feed.visibleOptions, id: \.rawValue) { option in
                    weatherOptionButton(option)
                }
            }

            if let tally = feed.weatherTally {
                tallyView(tally)
            }

            if feed.weatherMyVote != nil {
                Text("재투표하면 표가 바뀌어요 — 크레딧은 신선한 참여에만 지급돼요")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.fill.quaternary, in: RoundedRectangle(cornerRadius: 16))
    }

    private func weatherOptionButton(_ option: Components.Schemas.WeatherOption) -> some View {
        let isMyVote = feed.weatherMyVote?.optionValue == option.rawValue
        return Button {
            Task { await feed.castWeatherVote(option) }
        } label: {
            VStack(spacing: 4) {
                Image(systemName: WeatherOptionDisplay.symbol(for: option.rawValue))
                    .font(.body)
                Text(WeatherOptionDisplay.label(for: option.rawValue))
                    .font(.caption2)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 8)
            .background(
                isMyVote ? AnyShapeStyle(.tint.opacity(0.2)) : AnyShapeStyle(.fill.tertiary),
                in: RoundedRectangle(cornerRadius: 10)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 10)
                    .stroke(isMyVote ? AnyShapeStyle(.tint) : AnyShapeStyle(.clear), lineWidth: 1.5)
            )
        }
        .buttonStyle(.plain)
    }

    // MARK: - 집계

    @ViewBuilder
    private func tallyView(_ tally: Components.Schemas.Tally) -> some View {
        // 표본 판정은 서버 sampleSufficient만 따른다 (rule-min-sample-display)
        if tally.sampleSufficient {
            VStack(alignment: .leading, spacing: 6) {
                ForEach(feed.visibleOptions, id: \.rawValue) { option in
                    let count = tally.counts.additionalProperties[option.rawValue] ?? 0
                    let ratio = tally.totalVotes > 0 ? Double(count) / Double(tally.totalVotes) : 0
                    HStack(spacing: 8) {
                        Image(systemName: WeatherOptionDisplay.symbol(for: option.rawValue))
                            .font(.caption)
                            .frame(width: 20)
                        ProgressView(value: ratio)
                        Text(ratio.formatted(.percent.precision(.fractionLength(0))))
                            .font(.caption.monospacedDigit())
                            .frame(width: 42, alignment: .trailing)
                    }
                }
                Text("최근 2시간 · \(tally.totalVotes)명 참여")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
        } else {
            Label(
                tally.totalVotes == 0
                    ? "현재 위치의 첫 투표를 기다려요"
                    : "현재 위치의 첫 투표를 기다려요 · 지금까지 \(tally.totalVotes)명",
                systemImage: "sparkles"
            )
            .font(.footnote)
            .foregroundStyle(.secondary)
        }
    }

    // MARK: - 크레딧

    @ViewBuilder
    private var walletRow: some View {
        if let wallet = feed.wallet {
            HStack {
                Label("크레딧 \(wallet.balance)", systemImage: "circle.hexagongrid.circle")
                    .font(.subheadline.bold())
                Spacer()
                Text("오늘 적립 \(wallet.dailyEarned)/\(wallet.dailyCap)")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            .padding(.horizontal, 4)
        }
    }

    // MARK: - 큐레이션 주제 카드

    private func topicCard(_ entry: FeedStore.TopicEntry) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(entry.topic.title)
                .font(.headline)

            ForEach(entry.topic.options, id: \.value) { option in
                let isMyVote = entry.myVote?.optionValue == option.value
                let count = entry.tally.counts.additionalProperties[option.value] ?? 0
                Button {
                    Task { await feed.castCuratedVote(topicId: entry.topic.id, optionValue: option.value) }
                } label: {
                    HStack {
                        if let emoji = option.emoji { Text(emoji) }
                        Text(option.label)
                        if isMyVote {
                            Image(systemName: "checkmark.circle.fill")
                                .foregroundStyle(.tint)
                        }
                        Spacer()
                        Text("\(count)표")
                            .font(.caption.monospacedDigit())
                            .foregroundStyle(.secondary)
                    }
                    .padding(.vertical, 8)
                    .padding(.horizontal, 12)
                    .background(
                        isMyVote ? AnyShapeStyle(.tint.opacity(0.15)) : AnyShapeStyle(.fill.tertiary),
                        in: RoundedRectangle(cornerRadius: 10)
                    )
                }
                .buttonStyle(.plain)
            }

            Text("\(entry.tally.totalVotes)명 참여")
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.fill.quaternary, in: RoundedRectangle(cornerRadius: 16))
    }
}
