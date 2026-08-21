import Foundation
import Observation

/// 홈 화면의 피드 상태. 위젯과 같은 응답(action-tally-feed)을 소비한다.
@MainActor
@Observable
final class FeedStore {
    typealias Region = Components.Schemas.Region
    typealias Tally = Components.Schemas.Tally
    typealias MyVote = Components.Schemas.MyVote
    typealias Wallet = Components.Schemas.Wallet
    typealias Topic = Components.Schemas.Topic
    typealias WeatherOption = Components.Schemas.WeatherOption

    struct TopicEntry: Identifiable {
        let topic: Topic
        var tally: Tally
        var myVote: MyVote?
        var id: String { topic.id }
    }

    enum State {
        case idle
        case loading
        case loaded
        case failed(message: String)
    }

    private(set) var state: State = .idle
    private(set) var region: Region?
    private(set) var weatherTally: Tally?
    private(set) var weatherMyVote: MyVote?
    private(set) var visibleOptions: [WeatherOption] = []
    // 온도 축 — primary 축과 독립 집계 (term-temperature-option)
    private(set) var temperatureTally: Tally?
    private(set) var temperatureMyVote: MyVote?
    private(set) var temperatureOptions: [Components.Schemas.TemperatureOption] = []
    private(set) var topics: [TopicEntry] = []
    private(set) var wallet: Wallet?
    /// 투표 실패 안내 (크레딧 부족·마감 등) — 다음 성공 시 지워진다
    private(set) var voteErrorMessage: String?

    private var regionCode: String?

    func load(regionCode: String) async {
        self.regionCode = regionCode
        if case .idle = state { state = .loading }
        do {
            let client = try DadeulAPI.makeLocalClient()
            let payload = try await client.getFeed(query: .init(regionCode: regionCode)).ok.body.json
            region = payload.region
            weatherTally = payload.weather.tally
            weatherMyVote = payload.weather.myVote
            visibleOptions = payload.weather.visibleOptions
            temperatureTally = payload.weather.temperature.tally
            temperatureMyVote = payload.weather.temperature.myVote
            temperatureOptions = payload.weather.temperature.visibleOptions
            topics = payload.topics.map { entry in
                TopicEntry(topic: entry.topic, tally: entry.tally, myVote: entry.myVote)
            }
            wallet = payload.wallet
            state = .loaded
        } catch {
            state = .failed(message: "피드를 불러오지 못했어요 (\(error))")
        }
    }

    /// 날씨 투표 — 재투표는 같은 축 내 교체이며 크레딧이 지급되지 않는다 (rule-revote-replace).
    func castWeatherVote(_ option: WeatherOption) async {
        guard let regionCode else { return }
        await cast(topicId: "weather", optionValue: option.rawValue, regionCode: regionCode) { result in
            self.weatherTally = result.tally
            self.weatherMyVote = result.vote
        }
    }

    /// 온도 투표 — temperature 축, 날씨 축과 독립 (term-temperature-option).
    func castTemperatureVote(_ option: Components.Schemas.TemperatureOption) async {
        guard let regionCode else { return }
        await cast(topicId: "weather", optionValue: option.rawValue, regionCode: regionCode) { result in
            self.temperatureTally = result.tally
            self.temperatureMyVote = result.vote
        }
    }

    func castCuratedVote(topicId: String, optionValue: String) async {
        await cast(topicId: topicId, optionValue: optionValue, regionCode: nil) { result in
            guard let index = self.topics.firstIndex(where: { $0.id == topicId }) else { return }
            self.topics[index] = TopicEntry(
                topic: self.topics[index].topic,
                tally: result.tally,
                myVote: result.vote
            )
        }
    }

    private struct VoteResult {
        let vote: MyVote
        let wallet: Wallet
        let tally: Tally
    }

    private func cast(
        topicId: String,
        optionValue: String,
        regionCode: String?,
        apply: (VoteResult) -> Void
    ) async {
        do {
            let client = try DadeulAPI.makeLocalClient()
            let response = try await client.castVote(
                path: .init(topicId: topicId),
                body: .json(.init(optionValue: optionValue, regionCode: regionCode))
            )
            switch response {
            case .ok(let ok):
                let payload = try ok.body.json
                apply(VoteResult(vote: payload.vote, wallet: payload.wallet, tally: payload.tally))
                wallet = payload.wallet
                voteErrorMessage = nil
            case .conflict:
                voteErrorMessage = "마감된 주제예요"
            case .unprocessableContent:
                // 투표는 크레딧을 소비하지 않는다 — 크레딧 언급은 오해 유발이라 제거
                voteErrorMessage = "투표를 반영하지 못했어요 — 선택지를 다시 확인해 주세요"
            default:
                voteErrorMessage = "투표에 실패했어요 — 잠시 후 다시 시도해 주세요"
            }
        } catch {
            voteErrorMessage = "투표에 실패했어요 — 네트워크를 확인해 주세요"
        }
    }
}
