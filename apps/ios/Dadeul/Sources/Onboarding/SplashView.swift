import SwiftUI

/// 스플래시 — design/Splash.dc.html 기준. 미니멀 워드마크 + 하단 원형 스피너.
/// 계정 자동 생성(bootstrap)은 이 화면 뒤에서 진행된다 (spec-weather-vote-widget User Flow 1).
struct SplashView: View {
    /// 부트스트랩 실패 시 안내 문구 — nil이면 로딩 중
    var errorMessage: String?
    var onRetry: (() -> Void)?

    var body: some View {
        ZStack {
            DesignToken.bg.ignoresSafeArea()

            VStack(spacing: 10) {
                HStack(spacing: 10) {
                    Circle()
                        .fill(DesignToken.sky)
                        .frame(width: 10, height: 10)
                    Text("다들")
                        .font(DesignFont.extraBold(40))
                        .kerning(-0.5)
                        .foregroundStyle(DesignToken.ink)
                }
                Text("지금, 다들 어떠신가요?")
                    .font(DesignFont.medium(14))
                    .foregroundStyle(DesignToken.inkSub)
            }

            VStack {
                Spacer()
                // 원형 스피너 — 점 3개 인디케이터 금지 (온보딩 페이지 닷과 혼동, 2026-08-22 교정)
                if let errorMessage {
                    VStack(spacing: 12) {
                        Text(errorMessage)
                            .font(DesignFont.caption)
                            .foregroundStyle(DesignToken.inkSub)
                            .multilineTextAlignment(.center)
                        if let onRetry {
                            Button("다시 시도", action: onRetry)
                                .font(DesignFont.bold(14))
                                .foregroundStyle(DesignToken.sky)
                        }
                    }
                    .padding(.horizontal, 32)
                } else {
                    ProgressView()
                        .progressViewStyle(.circular)
                        .tint(DesignToken.sky)
                }
            }
            .padding(.bottom, 72)
        }
    }
}

#Preview {
    SplashView()
}
