import Foundation

/// 앱 ↔ 위젯이 공유하는 마지막 확정 지역 (App Group UserDefaults).
/// 서버도 계정에 지역을 캐시하지만(resolve 시), 수동 선택 지역은 클라이언트가 보관하고
/// feed 호출 시 regionCode로 전달한다.
enum RegionCache {
    private static let codeKey = "region.code"
    private static let nameKey = "region.name"

    private static var defaults: UserDefaults {
        UserDefaults(suiteName: AppEnvironment.appGroupId) ?? .standard
    }

    static var current: (code: String, name: String)? {
        guard
            let code = defaults.string(forKey: codeKey),
            let name = defaults.string(forKey: nameKey)
        else { return nil }
        return (code, name)
    }

    static func save(code: String, name: String) {
        defaults.set(code, forKey: codeKey)
        defaults.set(name, forKey: nameKey)
    }
}
