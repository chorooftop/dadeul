import Foundation
import OpenAPIRuntime
import OpenAPIURLSession

/// specs/openapi.yaml에서 빌드 시 자동 생성되는 Client의 팩토리.
/// 생성된 타입(Client, Servers)을 참조하므로 이 파일이 컴파일되면 코드젠 파이프라인이 살아있다는 뜻.
enum DadeulAPI {
    /// 로컬 개발 서버 (npm run dev:api) — openapi.yaml servers[1]
    static func makeLocalClient() throws -> Client {
        Client(
            serverURL: try Servers.Server2.url(),
            transport: URLSessionTransport(),
            middlewares: [BearerAuthMiddleware()]
        )
    }
}
