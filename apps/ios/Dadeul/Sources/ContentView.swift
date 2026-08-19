import SwiftUI

struct ContentView: View {
    @State private var account = AccountStore()

    var body: some View {
        VStack(spacing: 12) {
            Text("다들")
                .font(.largeTitle.bold())
            Text("투표로 결정된 지금")
                .foregroundStyle(.secondary)

            accountStatus
                .font(.footnote)
                .padding(.top, 24)
        }
        .padding()
        .task { await account.bootstrap() }
    }

    @ViewBuilder
    private var accountStatus: some View {
        switch account.state {
        case .idle, .bootstrapping:
            ProgressView("계정 연결 중…")
        case .ready(let accountId, let restored):
            VStack(spacing: 4) {
                Label(restored ? "계정 복원됨" : "새 계정 생성됨", systemImage: "person.fill.checkmark")
                Text(accountId)
                    .font(.caption2.monospaced())
                    .foregroundStyle(.secondary)
                if let region = account.cachedRegionName {
                    Text(region).foregroundStyle(.secondary)
                }
            }
        case .failed(let message):
            Label(message, systemImage: "exclamationmark.triangle")
                .foregroundStyle(.red)
        }
    }
}

#Preview {
    ContentView()
}
