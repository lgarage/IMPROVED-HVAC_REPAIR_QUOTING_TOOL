// firebase-config.js

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBSb5b6Or-7yoiRV_gPLx4ZrZjh5Srx5r0",
  authDomain: "twin-pillars-app.firebaseapp.com",
  projectId: "twin-pillars-app",
  storageBucket: "twin-pillars-app.firebasestorage.app",
  messagingSenderId: "845074873991",
  appId: "1:845074873991:web:1e5e404570ca09f6690222",
  measurementId: "G-8V6PXJJFW8"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize Firestore Database (we will use this 'db' variable in our other files)
const db = firebase.firestore();