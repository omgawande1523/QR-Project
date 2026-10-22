import UIKit
import Capacitor

/**
 * Prints the current screen with AirPrint (any AirPrint printer, or "Save to Files" as a PDF). The web side's
 * print styles apply, so a receipt prints like it does from the website. Same plugin name and method as
 * android/.../NativePrintPlugin.java; used by client/src/native/print.js.
 */
@objc(NativePrintPlugin)
public class NativePrintPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "NativePrintPlugin"
    public let jsName = "NativePrint"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "print", returnType: CAPPluginReturnPromise)
    ]

    @objc func print(_ call: CAPPluginCall) {
        let name = call.getString("name") ?? "Receipt"
        DispatchQueue.main.async {
            guard let webView = self.bridge?.webView, UIPrintInteractionController.isPrintingAvailable else {
                call.reject("Printing is not available on this device")
                return
            }
            let info = UIPrintInfo(dictionary: nil)
            info.outputType = .general
            info.jobName = name
            let controller = UIPrintInteractionController.shared
            controller.printInfo = info
            controller.printFormatter = webView.viewPrintFormatter()
            let done: UIPrintInteractionController.CompletionHandler = { _, completed, error in
                if let error = error {
                    call.reject(error.localizedDescription)
                } else {
                    call.resolve(["printed": completed])
                }
            }
            // On iPad the printer options appear as a popover, which needs a place on screen to point at.
            if UIDevice.current.userInterfaceIdiom == .pad, let view = self.bridge?.viewController?.view {
                controller.present(from: CGRect(x: view.bounds.midX, y: view.bounds.midY, width: 1, height: 1), in: view, animated: true, completionHandler: done)
            } else {
                controller.present(animated: true, completionHandler: done)
            }
        }
    }
}
