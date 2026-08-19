import Foundation
import Security

/// Keychain 문자열 저장 최소 래퍼. 앱·위젯이 같은 항목을 읽도록 Access Group을 우선 시도한다.
///
/// - 기기 키는 앱 삭제 후에도 Keychain에 보존된다 — 재설치 시 같은 계정 복원 (entity-device-account)
/// - 시뮬레이터·무서명 빌드는 Access Group 엔타이틀먼트 매칭이 실패할 수 있어(errSecMissingEntitlement)
///   앱 전용 저장으로 폴백한다. 위젯과의 실제 공유 검증은 실기기 단계로 이월 (계획 리스크 5와 동일 성격).
enum KeychainStore {
    enum Key: String {
        case deviceKey = "app.dadeul.deviceKey"
        case accessToken = "app.dadeul.accessToken"
        case accountId = "app.dadeul.accountId"
    }

    enum KeychainError: Error {
        case unexpectedStatus(OSStatus)
    }

    static func read(_ key: Key) -> String? {
        for accessGroup in accessGroupCandidates {
            var query = baseQuery(for: key, accessGroup: accessGroup)
            query[kSecReturnData as String] = true
            query[kSecMatchLimit as String] = kSecMatchLimitOne

            var result: AnyObject?
            let status = SecItemCopyMatching(query as CFDictionary, &result)
            if status == errSecSuccess, let data = result as? Data {
                return String(data: data, encoding: .utf8)
            }
        }
        return nil
    }

    static func write(_ value: String, for key: Key) throws {
        let data = Data(value.utf8)
        var lastStatus: OSStatus = errSecSuccess

        for accessGroup in accessGroupCandidates {
            let query = baseQuery(for: key, accessGroup: accessGroup)
            let attributes: [String: Any] = [kSecValueData as String: data]

            var status = SecItemUpdate(query as CFDictionary, attributes as CFDictionary)
            if status == errSecItemNotFound {
                var addQuery = query
                addQuery[kSecValueData as String] = data
                addQuery[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
                status = SecItemAdd(addQuery as CFDictionary, nil)
            }
            if status == errSecSuccess { return }
            lastStatus = status
        }
        throw KeychainError.unexpectedStatus(lastStatus)
    }

    /// 기기 키를 읽고, 없으면 새 UUID를 생성·보존한다 (기기 최초 실행).
    static func readOrCreateDeviceKey() throws -> String {
        if let existing = read(.deviceKey) { return existing }
        let created = UUID().uuidString.lowercased()
        try write(created, for: .deviceKey)
        return created
    }

    // Access Group 우선, 실패 시 앱 전용(nil) 폴백
    private static var accessGroupCandidates: [String?] {
        [AppEnvironment.keychainAccessGroup, nil]
    }

    private static func baseQuery(for key: Key, accessGroup: String?) -> [String: Any] {
        var query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: "app.dadeul",
            kSecAttrAccount as String: key.rawValue,
        ]
        if let accessGroup {
            query[kSecAttrAccessGroup as String] = accessGroup
        }
        return query
    }
}
