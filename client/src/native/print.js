import { registerPlugin } from '@capacitor/core';

// The app's own small plugin (mobile/android/.../NativePrintPlugin.java): prints the current screen through
// Android's print service, the same receipt layout the website prints (the @media print styles apply).
const NativePrint = registerPlugin('NativePrint');

export async function printWebView(jobName) {
  await NativePrint.print({ name: jobName });
}
