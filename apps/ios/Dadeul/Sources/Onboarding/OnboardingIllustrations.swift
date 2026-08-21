import SwiftUI

/// 온보딩 일러스트 3종 — design/Onboarding1~3.dc.html의 카드·위젯·위치 그림을 SwiftUI로 재현.
/// 실데이터가 아니라 고정 예시 수치다 (시안 그대로).

/// 개표 행 미니어처 — 일러스트 1(집계 카드)·2(위젯)가 공유
private struct SampleTallyRow: View {
    let rank: Int
    let label: String
    let ratio: CGFloat
    let percent: String
    var compact = false

    private var isTop: Bool { rank == 1 }

    var body: some View {
        HStack(spacing: compact ? 5 : 7) {
            Text("\(rank)")
                .font(DesignFont.bold(compact ? 9 : 10))
                .foregroundStyle(isTop ? DesignToken.surface : DesignToken.inkSub)
                .frame(width: compact ? 14 : 16, height: compact ? 14 : 16)
                .background(isTop ? DesignToken.sky : DesignToken.stroke, in: Circle())
            Text(label)
                .font(isTop ? DesignFont.bold(compact ? 12 : 13) : DesignFont.medium(compact ? 12 : 13))
                .foregroundStyle(DesignToken.ink)
                .frame(width: compact ? 28 : nil, alignment: .leading)
            GeometryReader { proxy in
                ZStack(alignment: .leading) {
                    Capsule().fill(isTop ? DesignToken.surface : DesignToken.stroke)
                    Capsule()
                        .fill(isTop ? DesignToken.sky : DesignToken.inkTer)
                        .frame(width: proxy.size.width * ratio)
                }
            }
            .frame(height: 5)
            Text(percent)
                .font(isTop ? DesignFont.extraBold(compact ? 12 : 13) : DesignFont.bold(compact ? 12 : 13))
                .foregroundStyle(isTop ? DesignToken.sky : DesignToken.inkSub)
                .frame(width: compact ? 32 : nil, alignment: .trailing)
        }
        .padding(.horizontal, compact ? 5 : 7)
        .padding(.vertical, compact ? 3 : 5)
        .background(isTop ? DesignToken.skyTint : Color.clear, in: RoundedRectangle(cornerRadius: compact ? 7 : 8))
        .padding(.horizontal, compact ? -5 : -7)
    }
}

/// ① 서비스 소개 — 집계 카드
struct TallyCardIllustration: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 6) {
                Circle().fill(DesignToken.sky).frame(width: 7, height: 7)
                Text("강남구")
                    .font(DesignFont.extraBold(15))
                    .foregroundStyle(DesignToken.ink)
            }
            SampleTallyRow(rank: 1, label: "맑음", ratio: 0.6, percent: "60%")
            SampleTallyRow(rank: 2, label: "흐림", ratio: 0.4, percent: "40%")
            Text("최근 2시간 · 5명 참여")
                .font(DesignFont.captionSmall)
                .foregroundStyle(DesignToken.inkTer)
        }
        .padding(18)
        .frame(width: 260)
        .background(DesignToken.surface, in: RoundedRectangle(cornerRadius: 20))
        .overlay(RoundedRectangle(cornerRadius: 20).stroke(DesignToken.stroke, lineWidth: 1))
    }
}

/// ② 위젯 가치 — small 위젯 미니어처 (그림자로 홈 화면 부유감)
struct WidgetIllustration: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 7) {
            HStack(spacing: 5) {
                Circle().fill(DesignToken.sky).frame(width: 6, height: 6)
                Text("강남구")
                    .font(DesignFont.extraBold(13))
                    .foregroundStyle(DesignToken.ink)
            }
            SampleTallyRow(rank: 1, label: "맑음", ratio: 0.6, percent: "60%", compact: true)
            SampleTallyRow(rank: 2, label: "흐림", ratio: 0.4, percent: "40%", compact: true)
            HStack(spacing: 4) {
                Text("체감")
                    .font(DesignFont.regular(10))
                    .foregroundStyle(DesignToken.inkSub)
                Text("더움 70%")
                    .font(DesignFont.bold(11))
                    .foregroundStyle(DesignToken.sky)
            }
            .padding(.top, 2)
            Spacer(minLength: 0)
            Text("5명 참여 · 12분 전")
                .font(DesignFont.regular(9))
                .foregroundStyle(DesignToken.inkTer)
        }
        .padding(14)
        .frame(width: 170, height: 170, alignment: .topLeading)
        .background(DesignToken.surface, in: RoundedRectangle(cornerRadius: 24))
        .overlay(RoundedRectangle(cornerRadius: 24).stroke(DesignToken.stroke, lineWidth: 1))
        .shadow(color: DesignToken.ink.opacity(0.08), radius: 16, y: 12)
    }
}

/// ③ 위치 안내 — 핀 + 시군구 칩
struct LocationIllustration: View {
    var body: some View {
        VStack(spacing: 16) {
            ZStack {
                Circle()
                    .fill(DesignToken.skyTint)
                    .frame(width: 96, height: 96)
                Image(systemName: "mappin.and.ellipse")
                    .font(.system(size: 40, weight: .light))
                    .foregroundStyle(DesignToken.sky)
            }
            Text("서울특별시 강남구")
                .font(DesignFont.bold(13))
                .foregroundStyle(DesignToken.sky)
                .padding(.horizontal, 14)
                .padding(.vertical, 7)
                .background(DesignToken.surface, in: Capsule())
                .overlay(Capsule().stroke(DesignToken.stroke, lineWidth: 1))
        }
    }
}
