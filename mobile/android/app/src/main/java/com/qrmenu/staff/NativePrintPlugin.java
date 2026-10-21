package com.qrmenu.staff;

import android.content.Context;
import android.print.PrintAttributes;
import android.print.PrintManager;
import android.webkit.WebView;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Prints the current screen through Android's print service (any installed printer, or "Save as PDF").
 * The web side's print styles apply, so a receipt prints like it does from the website.
 * Used by client/src/native/print.js.
 */
@CapacitorPlugin(name = "NativePrint")
public class NativePrintPlugin extends Plugin {

    @PluginMethod
    public void print(PluginCall call) {
        String name = call.getString("name", "Receipt");
        getActivity().runOnUiThread(() -> {
            try {
                WebView webView = getBridge().getWebView();
                PrintManager printManager = (PrintManager) getActivity().getSystemService(Context.PRINT_SERVICE);
                PrintAttributes attributes = new PrintAttributes.Builder().setMediaSize(PrintAttributes.MediaSize.ISO_A4).build();
                printManager.print(name, webView.createPrintDocumentAdapter(name), attributes);
                call.resolve();
            } catch (Exception e) {
                call.reject("Printing is not available on this device", e);
            }
        });
    }
}
