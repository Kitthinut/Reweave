import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";

const app = initializeApp({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
});

export const auth = getAuth(app);
export const db = initializeFirestore(app, {
  // ignoreUndefinedProperties: Firestore rejects `undefined` values otherwise
  ignoreUndefinedProperties: true,
  // keeps a copy in the browser (IndexedDB): fewer reads against the free quota, and edits made offline sync later
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});