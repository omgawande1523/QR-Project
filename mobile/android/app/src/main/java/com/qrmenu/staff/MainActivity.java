package com.qrmenu.staff;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // The app's own plugins (npm plugins are registered automatically by Capacitor).
        registerPlugin(NativePrintPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
