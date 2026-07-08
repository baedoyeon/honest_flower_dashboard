import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import firebaseConfig from "../../firebase-applet-config.json";

// Diagnostic logs for troubleshooting Firebase configuration loading
console.log("Raw firebaseConfig imported:", firebaseConfig);

// Resilient retrieval of config fields (handling possible module namespace wrappers)
const config: any = (firebaseConfig && (firebaseConfig as any).default) 
  ? (firebaseConfig as any).default 
  : firebaseConfig;

console.log("Resolved firebase config:", {
  projectId: config?.projectId,
  firestoreDatabaseId: config?.firestoreDatabaseId,
  hasApiKey: !!config?.apiKey,
  hasAppId: !!config?.appId
});

if (!config || !config.projectId) {
  console.error("Firebase configuration is invalid or missing projectId! Loaded config:", config);
}

// Initialize Firebase
const app = initializeApp({
  apiKey: config.apiKey,
  authDomain: config.authDomain,
  projectId: config.projectId,
  storageBucket: config.storageBucket,
  messagingSenderId: config.messagingSenderId,
  appId: config.appId,
  measurementId: config.measurementId
});

// Initialize Firestore with custom database ID if provided
export const db = getFirestore(app, config.firestoreDatabaseId || "(default)");

// Detailed logging of the initialized db object properties to confirm target project and database
try {
  const activeProjectId = db.app?.options?.projectId || "N/A";
  const activeDatabaseId = (db as any)._databaseId?.database || (db as any).databaseId || "(default)";
  console.log("🔥 [Firebase Init] Firestore instance initialized successfully!");
  console.log("👉 Target Project ID:", activeProjectId);
  console.log("👉 Target Database ID:", activeDatabaseId);
  console.log("👉 Full Firestore Instance Config:", {
    projectId: activeProjectId,
    databaseId: activeDatabaseId,
    appSettings: db.app?.options
  });
} catch (e) {
  console.error("Failed to print diagnostic database logs:", e);
}


