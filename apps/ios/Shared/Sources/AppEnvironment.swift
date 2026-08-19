import Foundation

/// 앱 타깃과 위젯 익스텐션이 공유하는 식별자 상수.
/// project.yml의 엔타이틀먼트 선언과 반드시 일치해야 한다.
enum AppEnvironment {
    /// App Group — 앱 ↔ 위젯 간 피드 스냅샷 공유에 사용 (계획 6단계)
    static let appGroupId = "group.app.dadeul"

    /// Keychain Access Group — 기기 계정 토큰을 앱·위젯이 함께 읽는다 (계획 3단계)
    /// 실기기에서는 AppIdentifierPrefix(팀 ID)가 앞에 붙는다.
    static let keychainAccessGroup = "app.dadeul.shared"
}
