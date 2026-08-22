import Foundation
import OpenAPIRuntime
import OpenAPIURLSession

/// specs/openapi.yaml에서 빌드 시 자동 생성되는 Client의 팩토리.
/// 생성된 타입(Client, Servers)을 참조하므로 이 파일이 컴파일되면 코드젠 파이프라인이 살아있다는 뜻.
enum DadeulAPI {
    /// 빌드 구성이 서버를 정한다 — 코드에 URL을 쓰지 않는다.
    /// 계약(specs/openapi.yaml)의 servers가 유일한 출처이고, 앱은 그중 하나를 고르기만 한다.
    ///
    /// - Debug: `servers[1]` 로컬 개발 서버 (`npm run dev:api`)
    /// - Release: `servers[0]` 배포 서버
    ///
    /// 배포 도메인이 바뀌면 이 파일이 아니라 `specs/openapi.yaml`의 `servers[0]`을 고친다.
    static func serverURL() throws -> URL {
        #if DEBUG
            return try Servers.Server2.url()
        #else
            return try Servers.Server1.url()
        #endif
    }

    static func makeClient() throws -> Client {
        Client(
            serverURL: try serverURL(),
            // 서버 date-time은 밀리초 포함 ISO 8601 (예: 2026-08-19T15:07:54.069Z)
            configuration: .init(dateTranscoder: .iso8601WithFractionalSeconds),
            transport: URLSessionTransport(),
            middlewares: [BearerAuthMiddleware()]
        )
    }
}
