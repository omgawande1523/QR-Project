import { LegalLayout, ContactLine } from './LegalLayout';
import { APP_NAME } from '../../config';

// The privacy policy for the website and the "QR Menu Staff" app for Android, iPhone and iPad (Google Play, the
// App Store and the app's Settings link here).
// Keep it in step with docs/PLAY_STORE.md (Data safety answers).
export default function PrivacyPage() {
  return (
    <LegalLayout title="Privacy policy" updated="21 October 2026">
      <p>
        {APP_NAME} lets restaurants show their menu through a QR code and take orders from their tables. This page
        explains what we collect on the website and in the {APP_NAME} Staff app, why, and how to delete it.
        Write to <ContactLine /> with any question.
      </p>

      <h2>What we collect</h2>
      <table>
        <thead><tr><th>Who</th><th>What</th><th>Why</th></tr></thead>
        <tbody>
          <tr><td>Restaurant owners</td><td>Email address, password (stored only as a one-way hash), optional mobile number, restaurant name, address, GSTIN, UPI ID, opening hours, menu, photos you upload</td><td>Your account, your public menu, GST bills and UPI payment QR codes</td></tr>
          <tr><td>Restaurant staff</td><td>Name, email address, password hash, role, last sign-in time</td><td>Staff logins with the right permissions</td></tr>
          <tr><td>Guests ordering at a table</td><td>Table number, dishes ordered, notes, an optional name, and an optional rating and comment after the meal</td><td>Sending the order to the restaurant, showing its status, the bill, and feedback for the restaurant</td></tr>
          <tr><td>Signed-in devices</td><td>A device name (for example &quot;Chrome on Windows&quot; or the phone model), website or app, when it was last active, and in the app a push-notification token</td><td>The &quot;Signed-in devices&quot; list in Settings, signing a device out, and order notifications</td></tr>
        </tbody>
      </table>
      <p>
        We do not sell personal data, show advertising or use advertising or analytics trackers. Server logs record
        the page or API address, the result and the time taken; they do not record IP addresses, passwords, tokens
        or what was typed into forms.
      </p>

      <h2>The {APP_NAME} Staff app</h2>
      <ul>
        <li><strong>Camera and photos</strong>: only when you choose &quot;Take photo&quot; or &quot;Choose from gallery&quot; (&quot;Choose from Photos&quot; on iPhone) to add a dish photo or logo. The picture you pick is uploaded; nothing else on the phone is read. On iPhone, saving a QR code or bill to Photos only adds that file.</li>
        <li><strong>Notifications</strong>: new orders, table requests and ready orders are sent through Google Firebase Cloud Messaging (and, on iPhone and iPad, Apple Push Notification service). You can turn each type off in the app&apos;s Settings, or all of them in the phone&apos;s settings.</li>
        <li><strong>Sign-in</strong>: your login is kept in the phone&apos;s secure storage (Android Keystore, or the iOS Keychain) and removed when you sign out.</li>
        <li>The app does not collect your location, contacts, call logs or files, and does not track you across other apps or websites.</li>
        <li><strong>Deleting your account</strong>: in the app or on the website, Settings &gt; Delete account, or on the <a href="/delete-account">account deletion page</a>.</li>
      </ul>

      <h2>Where the data is kept</h2>
      <p>
        On servers run by our hosting providers: the database (MongoDB Atlas), the application server (Render),
        uploaded photos (Cloudinary) and push notifications (Google Firebase). Data is sent over encrypted HTTPS
        connections. Each restaurant and each staff role can reach only its own data.
      </p>

      <h2>How long we keep it</h2>
      <p>
        As long as the restaurant account exists. Signed-in devices are forgotten when they sign out, after 7 days
        without use on the website and 30 days in the app. Photos that were uploaded but never used are deleted after
        24 hours.
      </p>

      <h2>Deleting your data</h2>
      <p>
        Owners can delete the restaurant and everything in it (menu, orders, bills, staff logins, photos and devices)
        from <strong>Settings &gt; Delete account</strong> on the website or in the app, or on the{' '}
        <a href="/delete-account">account deletion page</a>. Staff can delete their own login the same way, or ask the
        owner to remove them. Restaurants need to keep bills for tax purposes: download any you need before deleting.
        Guests who want an order or rating removed can ask the restaurant, or write to us.
      </p>

      <h2>Children</h2>
      <p>{APP_NAME} is a tool for restaurant businesses and is not meant for children.</p>

      <h2>Changes</h2>
      <p>If this policy changes we will update this page and the date at the top.</p>
    </LegalLayout>
  );
}
