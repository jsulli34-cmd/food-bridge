import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

// Replace these with your Firebase Web App config values.
const firebaseConfig = {
  apiKey: "REPLACE_ME",
  authDomain: "REPLACE_ME",
  projectId: "REPLACE_ME",
  storageBucket: "REPLACE_ME",
  messagingSenderId: "REPLACE_ME",
  appId: "REPLACE_ME",
};

export const isFirebaseConfigured =
  firebaseConfig.apiKey !== "REPLACE_ME" &&
  firebaseConfig.projectId !== "REPLACE_ME" &&
  firebaseConfig.appId !== "REPLACE_ME";

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
