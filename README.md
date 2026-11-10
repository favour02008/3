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
