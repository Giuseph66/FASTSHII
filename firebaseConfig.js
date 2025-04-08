
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: "AIzaSyCb17Coub8NwR4eXiMrvrIzyPPOsAVwdUo",
    authDomain: "base-fastshii.firebaseapp.com",
    databaseURL: "https://base-fastshii-default-rtdb.firebaseio.com",
    projectId: "base-fastshii",
    storageBucket: "base-fastshii.firebasestorage.app",
    messagingSenderId: "1023790791454",
    appId: "1:1023790791454:web:041067783fe2c25384a70f",
    measurementId: "G-CDERLJ45B0"
  };

const app = initializeApp(firebaseConfig);

export const firestore = getFirestore(app);
