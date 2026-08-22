import Foundation
import Observation

/// 익명 기기 계정의 부트스트랩 상태 (entity-device-account).
/// 첫 실행: deviceKey 생성 → bootstrap → 토큰·계정 ID 보존.
/// 재실행: 보존된 deviceKey로 같은 계정 복원, 토큰은 회전분으로 교체.
@MainActor
@Observable
final class AccountStore {
    enum State {
        case idle
        case bootstrapping
        case ready(accountId: String, restored: Bool)
        case failed(message: String)
    }

    private(set) var state: State = .idle
    /// 서버가 캐시해 둔 마지막 판별 지역 (판별 이력 없으면 nil)
    private(set) var cachedRegion: Components.Schemas.Region?

    func bootstrap() async {
        state = .bootstrapping
        do {
            let deviceKey = try KeychainStore.readOrCreateDeviceKey()
            let client = try DadeulAPI.makeClient()
            let response = try await client.bootstrapAccount(
                body: .json(.init(deviceKey: deviceKey, platform: .ios))
            )
            let payload = try response.ok.body.json

            // 토큰 회전: 이전 토큰은 서버에서 이미 무효 — 최신 토큰만 보존한다
            try KeychainStore.write(payload.accessToken, for: .accessToken)
            try KeychainStore.write(payload.accountId, for: .accountId)

            cachedRegion = payload.region
            state = .ready(accountId: payload.accountId, restored: !payload.created)
        } catch {
            state = .failed(message: "계정 연결에 실패했어요 — 네트워크를 확인해 주세요 (\(error))")
        }
    }
}
