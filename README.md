# ClassBridge

Source code imported from the AppDeploy ClassBridge project.

## Firebase connection

The Firebase client module is available at `src/firebase.ts` for the
`classbridge-95004` project. Before enabling Firebase sign-in in the app:

1. In Firebase Console, enable **Authentication → Sign-in method → Google**.
2. Add the app's web host to **Authentication → Settings → Authorized domains**.
3. Create a **Cloud Firestore** database and apply restrictive security rules.
4. For a native Android Google sign-in flow, register the Android package in
   Firebase, add the SHA-1/SHA-256 signing fingerprints, and include the
   generated `google-services.json` in the Android project. Do not commit
   service-account credentials or private keys.

The existing ClassBridge API calls still depend on the current AppDeploy backend.
A complete data/auth migration must move those API routes and their authorization
rules to Firebase before removing that backend; switching only the login provider
would break classroom data access.

## Android push notifications (Firebase Cloud Messaging)

ClassBridge now includes the Capacitor Push Notifications client and in-app notification effects. To enable delivery while the Android app is closed, complete the native Firebase setup:

1. In Firebase Console, open Project settings → Your apps and register the Android app with package ID `com.classbridge.app`.
2. Download the matching `google-services.json` and place it at `android/app/google-services.json` (do not use a file from a different Firebase project/package).
3. Ensure the Android Gradle project applies the Google Services Gradle plugin, then run `npx cap sync android` after installing dependencies.
4. Enable Cloud Messaging for the Firebase project and configure a trusted server (for example, Firebase Cloud Functions using the Admin SDK) to send FCM messages to each user's registered device token.
5. Store tokens securely against the signed-in user on the server. Do not put Firebase Admin service-account credentials in the app or repository.
6. Build and test on a real Android device. Grant the Android notification permission when prompted.

The client can register a device token and receive FCM messages, but closed-app push delivery is not fully operational until the Android Firebase file, Gradle setup, and trusted server-side message sender are configured. The current notification history and in-app toast effects continue to work for events the running app receives.
