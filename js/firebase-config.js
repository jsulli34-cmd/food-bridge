import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

// Replace these with your Firebase Web App config values.
const firebaseConfig = {
  apiKey: "AIzaSyCuyDaad9c8dUzoz4khAkps2BnmboAvNOU",
  authDomain: "food-bridge-beta.firebaseapp.com",
  projectId: "food-bridge-beta",
  storageBucket: "food-bridge-beta.firebasestorage.app",
  messagingSenderId: "910553294033",
  appId: "1:910553294033:web:8f28fcc74027fad3d111f0"
};

export const isFirebaseConfigured =
  firebaseConfig.apiKey !== "REPLACE_ME" &&
  firebaseConfig.projectId !== "REPLACE_ME" &&
  firebaseConfig.appId !== "REPLACE_ME";

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
