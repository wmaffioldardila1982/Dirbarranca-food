// Reemplaza con tus credenciales reales de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyBl7aa3LfCVyT2U8yrUJihFfy05Zi3WIGM",
  authDomain: "barranca-food.firebaseapp.com",
  projectId: "barranca-food",
  storageBucket: "barranca-food.firebasestorage.app",
  messagingSenderId: "833614115555",
  appId: "1:833614115555:web:905f25f8093c11780a0bd6"
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();