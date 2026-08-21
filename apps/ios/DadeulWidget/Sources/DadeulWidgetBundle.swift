import SwiftUI
import WidgetKit

@main
struct DadeulWidgetBundle: WidgetBundle {
    init() {
        DesignFont.register()
    }

    var body: some Widget {
        DadeulWidget()
    }
}
