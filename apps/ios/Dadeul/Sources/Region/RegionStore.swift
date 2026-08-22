import Foundation
import Observation

/// 지역 판별 상태 머신: 서버 캐시 → GPS 판별 → 실패 시 수동 선택 fallback.
@MainActor
@Observable
final class RegionStore {
    typealias Region = Components.Schemas.Region

    enum State {
        case idle
        case determining
        case resolved(Region)
        case manualSelection(regions: [Region], reason: String)
        case failed(message: String)
    }

    private(set) var state: State = .idle
    private let locationService = LocationService()

    /// 부트스트랩 직후 진입점 — 서버가 캐시한 지역이 있으면 그대로 확정한다.
    func start(serverCachedRegion: Region?) async {
        if let region = serverCachedRegion {
            confirm(region)
            return
        }
        await determineByLocation()
    }

    /// GPS → resolve. 권한 거부·판별 불가(422)·서버 오류는 전부 수동 선택으로 넘긴다.
    func determineByLocation() async {
        state = .determining
        do {
            let coordinate = try await locationService.currentCoordinate()
            let client = try DadeulAPI.makeClient()
            let response = try await client.resolveRegion(
                body: .json(.init(latitude: coordinate.latitude, longitude: coordinate.longitude))
            )
            switch response {
            case .ok(let ok):
                confirm(try ok.body.json)
            case .unprocessableContent:
                await loadManualSelection(reason: "지원하지 않는 위치예요 — 동네를 직접 골라 주세요")
            default:
                await loadManualSelection(reason: "지역 판별에 실패했어요 — 동네를 직접 골라 주세요")
            }
        } catch LocationService.LocationError.denied {
            await loadManualSelection(reason: "위치 권한이 꺼져 있어요 — 동네를 직접 골라 주세요")
        } catch {
            await loadManualSelection(reason: "지역 판별에 실패했어요 — 동네를 직접 골라 주세요")
        }
    }

    func select(_ region: Region) {
        confirm(region)
    }

    private func loadManualSelection(reason: String) async {
        do {
            let client = try DadeulAPI.makeClient()
            let regions = try await client.listRegions().ok.body.json.regions
            state = .manualSelection(regions: regions, reason: reason)
        } catch {
            state = .failed(message: "지역 목록을 불러오지 못했어요 (\(error))")
        }
    }

    private func confirm(_ region: Region) {
        RegionCache.save(code: region.code, name: region.name)
        state = .resolved(region)
    }
}
