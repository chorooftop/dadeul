import SwiftUI

/// 지역 확정 전 화면 — 판별 진행·수동 선택 fallback·실패 안내.
/// 온보딩 이후의 흐름이며, 권한 거부·REGION_UNRESOLVED 시 수동 선택이 뜬다 (spec 에러 경로).
struct RegionSetupView: View {
    let region: RegionStore

    var body: some View {
        VStack(spacing: 16) {
            switch region.state {
            case .idle, .resolved:
                // resolved면 상위(ContentView)가 홈으로 전환한다
                EmptyView()
            case .determining:
                Spacer()
                ProgressView()
                    .progressViewStyle(.circular)
                    .tint(DesignToken.sky)
                Text("현재 위치를 찾는 중…")
                    .font(DesignFont.body)
                    .foregroundStyle(DesignToken.inkSub)
                Spacer()
            case .manualSelection(let regions, let reason):
                manualSelection(regions: regions, reason: reason)
            case .failed(let message):
                Spacer()
                Label(message, systemImage: "exclamationmark.triangle")
                    .font(DesignFont.caption)
                    .foregroundStyle(.red)
                Spacer()
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(DesignToken.bg.ignoresSafeArea())
    }

    private func manualSelection(regions: [RegionStore.Region], reason: String) -> some View {
        VStack(spacing: 12) {
            Text("동네 고르기")
                .font(DesignFont.cardTitle)
                .foregroundStyle(DesignToken.ink)
                .padding(.top, 24)
            Text(reason)
                .font(DesignFont.caption)
                .foregroundStyle(DesignToken.inkSub)

            if regions.isEmpty {
                // 전국 오픈 정책 — 목록이 비면 "닫힌 동네"가 아니라 로드 실패다
                Text("동네 목록을 불러오지 못했어요 — 잠시 후 다시 시도해 주세요")
                    .font(DesignFont.caption)
                    .foregroundStyle(DesignToken.inkTer)
                Spacer()
            } else {
                List(regions, id: \.code) { candidate in
                    Button {
                        region.select(candidate)
                    } label: {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(candidate.name)
                                .font(DesignFont.body)
                                .foregroundStyle(DesignToken.ink)
                            Text(candidate.fullName)
                                .font(DesignFont.caption)
                                .foregroundStyle(DesignToken.inkSub)
                        }
                    }
                    .listRowBackground(DesignToken.surface)
                }
                .listStyle(.plain)
                .scrollContentBackground(.hidden)
                .background(DesignToken.surface, in: RoundedRectangle(cornerRadius: 20))
                .overlay(RoundedRectangle(cornerRadius: 20).stroke(DesignToken.stroke, lineWidth: 1))
                .padding(.horizontal, 20)
            }

            Button("위치로 다시 찾기") {
                Task { await region.determineByLocation() }
            }
            .font(DesignFont.bold(14))
            .foregroundStyle(DesignToken.sky)
            .padding(.bottom, 24)
        }
    }
}
