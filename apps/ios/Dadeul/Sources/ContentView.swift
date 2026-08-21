import SwiftUI

/// 첫 실행 흐름: 스플래시(계정 부트스트랩) → 온보딩 3장(최초 1회) → 지역 판별(권한 요청) → 홈.
/// spec-weather-vote-widget User Flow 1.
struct ContentView: View {
    @State private var account = AccountStore()
    @State private var region = RegionStore()
    /// 온보딩은 최초 1회 — 완료 후 다시 보이지 않는다
    @AppStorage("onboarding.completed") private var onboardingCompleted = false

    var body: some View {
        Group {
            switch account.state {
            case .idle, .bootstrapping:
                SplashView()
            case .failed(let message):
                SplashView(errorMessage: message) {
                    Task { await account.bootstrap() }
                }
            case .ready:
                if needsOnboarding {
                    OnboardingView { onboardingCompleted = true }
                } else {
                    regionFlow
                }
            }
        }
        .task { await account.bootstrap() }
    }

    /// 계정 복원으로 서버 캐시 지역이 있으면(재설치) 온보딩을 건너뛴다 — 이미 아는 사용자다
    private var needsOnboarding: Bool {
        !onboardingCompleted && account.cachedRegion == nil
    }

    @ViewBuilder
    private var regionFlow: some View {
        Group {
            if case .resolved(let resolved) = region.state {
                HomeView(region: resolved) {
                    Task { await region.determineByLocation() }
                }
            } else {
                RegionSetupView(region: region)
            }
        }
        .task {
            // 온보딩 완료(또는 생략) 뒤에만 시작 — 위치 권한 팝업이 온보딩 앞에 뜨지 않게
            if case .idle = region.state {
                await region.start(serverCachedRegion: account.cachedRegion)
            }
        }
    }
}

#Preview {
    ContentView()
}
