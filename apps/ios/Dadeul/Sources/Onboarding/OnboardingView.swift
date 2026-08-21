import SwiftUI

/// 온보딩 3장 스와이프 — design/Onboarding1~3.dc.html 기준. 최초 1회만 노출.
/// 1~2장 우상단 "건너뛰기", 3장 [시작하기] → 완료 시 지역 판별(위치 권한 요청)로 진행.
/// 건너뛰어도 지역 판별 시점에 시스템 권한 팝업은 뜬다 (spec-weather-vote-widget User Flow 1).
struct OnboardingView: View {
    let onComplete: () -> Void

    @State private var page = 0

    private var isLastPage: Bool { page == 2 }

    var body: some View {
        VStack(spacing: 0) {
            skipRow

            TabView(selection: $page) {
                pageView(
                    illustration: { TallyCardIllustration() },
                    title: "현재 위치의 지금 날씨,\n투표로 알아요",
                    subtitle: "예보 말고, 지금 밖에 있는 이웃들의 투표로\n현재 위치의 진짜 지금을 확인해요"
                )
                .tag(0)
                pageView(
                    illustration: { WidgetIllustration() },
                    title: "홈 화면에서 바로 확인",
                    subtitle: "위젯을 추가하면 현재 위치의 1위 날씨가\n30분마다 홈 화면에 떠요"
                )
                .tag(1)
                pageView(
                    illustration: { LocationIllustration() },
                    title: "위치는 시군구까지만\n사용해요",
                    subtitle: "정확한 위치는 저장하지 않아요.\n현재 위치(시군구)를 찾는 데만 써요"
                )
                .tag(2)
            }
            .tabViewStyle(.page(indexDisplayMode: .never))

            footer
        }
        .background(DesignToken.bg.ignoresSafeArea())
    }

    private var skipRow: some View {
        HStack {
            Spacer()
            Button("건너뛰기", action: onComplete)
                .font(DesignFont.medium(13))
                .foregroundStyle(DesignToken.inkSub)
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
        }
        .padding(.horizontal, 10)
        // 3장은 [시작하기]가 유일한 출구 — 자리는 유지해 레이아웃 점프를 막는다
        .opacity(isLastPage ? 0 : 1)
        .animation(.easeInOut(duration: 0.15), value: isLastPage)
    }

    private func pageView(
        @ViewBuilder illustration: () -> some View,
        title: String,
        subtitle: String
    ) -> some View {
        VStack(spacing: 40) {
            illustration()
            VStack(spacing: 12) {
                Text(title)
                    .font(DesignFont.extraBold(24))
                    .foregroundStyle(DesignToken.ink)
                    .lineSpacing(5)
                Text(subtitle)
                    .font(DesignFont.medium(14))
                    .foregroundStyle(DesignToken.inkSub)
                    .lineSpacing(4)
            }
            .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(.horizontal, 24)
    }

    private var footer: some View {
        VStack(spacing: 24) {
            HStack(spacing: 7) {
                ForEach(0..<3, id: \.self) { index in
                    Circle()
                        .fill(index == page ? DesignToken.sky : DesignToken.stroke)
                        .frame(width: 7, height: 7)
                }
            }

            VStack(spacing: 10) {
                Button {
                    if isLastPage {
                        onComplete()
                    } else {
                        withAnimation { page += 1 }
                    }
                } label: {
                    Text(isLastPage ? "시작하기" : "다음")
                        .font(DesignFont.bold(16))
                        .foregroundStyle(DesignToken.surface)
                        .frame(maxWidth: .infinity)
                        .frame(height: 52)
                        .background(DesignToken.sky, in: RoundedRectangle(cornerRadius: 14))
                }
                .buttonStyle(.plain)

                if isLastPage {
                    Text("시작하면 위치 권한을 요청해요")
                        .font(DesignFont.captionSmall)
                        .foregroundStyle(DesignToken.inkTer)
                }
            }
        }
        .padding(.horizontal, 24)
        .padding(.bottom, 24)
    }
}

#Preview {
    OnboardingView(onComplete: {})
}
