import SwiftUI

struct ContentView: View {
    @State private var account = AccountStore()
    @State private var region = RegionStore()

    var body: some View {
        Group {
            if case .resolved(let resolved) = region.state {
                HomeView(region: resolved) {
                    Task { await region.determineByLocation() }
                }
            } else {
                onboarding
            }
        }
        .task {
            await account.bootstrap()
            if case .ready = account.state {
                await region.start(serverCachedRegion: account.cachedRegion)
            }
        }
    }

    private var onboarding: some View {
        VStack(spacing: 16) {
            Text("다들")
                .font(.largeTitle.bold())
            Text("투표로 결정된 지금")
                .foregroundStyle(.secondary)

            accountStatus
                .font(.footnote)

            regionSection
                .frame(maxHeight: 320)
        }
        .padding()
    }

    @ViewBuilder
    private var accountStatus: some View {
        switch account.state {
        case .idle, .bootstrapping:
            ProgressView("계정 연결 중…")
        case .ready(_, let restored):
            Label(restored ? "계정 복원됨" : "새 계정 생성됨", systemImage: "person.fill.checkmark")
                .foregroundStyle(.secondary)
        case .failed(let message):
            Label(message, systemImage: "exclamationmark.triangle")
                .foregroundStyle(.red)
        }
    }

    @ViewBuilder
    private var regionSection: some View {
        switch region.state {
        case .idle:
            EmptyView()
        case .determining:
            ProgressView("내 동네 찾는 중…")
        case .resolved:
            // 확정되면 body가 HomeView로 전환된다
            EmptyView()
        case .manualSelection(let regions, let reason):
            VStack(spacing: 8) {
                Text(reason)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                if regions.isEmpty {
                    // 전국 오픈 정책 — 목록이 비면 "닫힌 동네"가 아니라 로드 실패다
                    Text("동네 목록을 불러오지 못했어요 — 잠시 후 다시 시도해 주세요")
                        .font(.footnote)
                        .foregroundStyle(.tertiary)
                } else {
                    List(regions, id: \.code) { candidate in
                        Button {
                            region.select(candidate)
                        } label: {
                            VStack(alignment: .leading) {
                                Text(candidate.name)
                                Text(candidate.fullName)
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }
                    .listStyle(.plain)
                }
                Button("위치로 다시 찾기") {
                    Task { await region.determineByLocation() }
                }
                .font(.caption)
            }
        case .failed(let message):
            Label(message, systemImage: "exclamationmark.triangle")
                .font(.footnote)
                .foregroundStyle(.red)
        }
    }
}

#Preview {
    ContentView()
}
