import UIKit
import Capacitor

// The app's web view: registers the app's own plugins and adds the iOS touches.
class MainViewController: CAPBridgeViewController {

    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(NativePrintPlugin())

        // iOS has no back button: swiping in from the left edge goes back, as in Safari (the screens use
        // ordinary browser history).
        webView?.allowsBackForwardNavigationGestures = true

        // iPhone stays in portrait except on the kitchen display, which unlocks rotation through the
        // screen-orientation plugin (client/src/app/AppShell.jsx). The plugin has already read the full list
        // from Info.plist, which unlock() goes back to. iPad keeps every orientation.
        if UIDevice.current.userInterfaceIdiom == .phone {
            supportedOrientations = [UIInterfaceOrientation.portrait.rawValue]
        }
    }
}
