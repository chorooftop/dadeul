import Foundation
import HTTPTypes
import OpenAPIRuntime

/// Keychain의 최신 접근 토큰을 모든 요청에 Bearer로 주입한다.
/// 토큰은 bootstrap마다 회전하므로(entity-device-account) 요청 시점에 매번 읽는다.
struct BearerAuthMiddleware: ClientMiddleware {
    func intercept(
        _ request: HTTPRequest,
        body: HTTPBody?,
        baseURL: URL,
        operationID: String,
        next: @Sendable (HTTPRequest, HTTPBody?, URL) async throws -> (HTTPResponse, HTTPBody?)
    ) async throws -> (HTTPResponse, HTTPBody?) {
        var request = request
        if let token = KeychainStore.read(.accessToken) {
            request.headerFields[.authorization] = "Bearer \(token)"
        }
        return try await next(request, body, baseURL)
    }
}
