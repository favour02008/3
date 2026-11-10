import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  browserLocalPersistence,
  getAuth,
  setPersistence,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Firebase web configuration is a public client identifier, not a service-account
// credential. Never place service-account JSON or private keys in this app.
const firebaseConfig = {
  apiKey: 'AIzaSyCxzBYXEY3glaC1KXRT4Z3IQmXsEMzKCE',
  authDomain: 'classbridge-95004.firebaseapp.com',
  projectId: 'classbridge-95004',
  storageBucket: 'classbridge-95004.firebasestorage.app',
  messagingSenderId: '1087876678468',
  appId: '1:1087876678468:web:54cbbe2792f4ce64894d11',
  measurementId: 'G-XSJVK5R7T1',
};

export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const firebaseAuth = getAuth(firebaseApp);
export const firestore = getFirestore(firebaseApp);
export const googleProvider = new GoogleAuthProvider();

googleProvider.setCustomParameters({ prompt: 'select_account' });

export async function prepareFirebaseAuth() {
  await setPersistence(firebaseAuth, browserLocalPersistence);
}

export async function signInWithGoogle() {
  await prepareFirebaseAuth();
  try {
    return await signInWithPopup(firebaseAuth, googleProvider);
  } catch (error) {
    const code = (error as { code?: string })?.code;
    if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
      await signInWithRedirect(firebaseAuth, googleProvider);
      return null;
    }
    throw error;
  }
}

export async function finishGoogleRedirect() {
  return getRedirectResult(firebaseAuth);
}

export async function signOutFromFirebase() {
  await firebaseSignOut(firebaseAuth);
}
