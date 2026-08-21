import SwiftUI

@main
struct DadeulApp: App {
    init() {
        DesignFont.register()
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}
