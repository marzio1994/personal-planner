import { initializeApp } from "firebase/app";
import { getFirestore, doc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAt315bty8QsB6VmzGgKmReosh1Hj7cV2A",
  authDomain: "personal-planner-6e653.firebaseapp.com",
  projectId: "personal-planner-6e653",
  storageBucket: "personal-planner-6e653.firebasestorage.app",
  messagingSenderId: "155806900219",
  appId: "1:155806900219:web:6ac00817a3ec3369b4f55e",
  measurementId: "G-Y4FLD1YF7S"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const plannerDoc = doc(db, "planner", "data");
