import { initializeApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import { getFirestore, doc, setDoc } from "firebase/firestore";

// Configuração do Firebase (mesma do client)
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: `${process.env.VITE_FIREBASE_PROJECT_ID}.firebaseapp.com`,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: `${process.env.VITE_FIREBASE_PROJECT_ID}.appspot.com`,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: process.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

async function createAdmin() {
  const adminData = {
    email: "admin@enemplus.com",
    password: "123456",
    cpf: "709.731.041-39",
    matricula: "9318",
    nome: "Administrador",
    tipo: "diretor",
    ativo: true,
    status: "aprovado"
  };

  try {
    console.log("Criando conta de autenticação...");
    
    // Criar usuário no Firebase Authentication
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      adminData.email,
      adminData.password
    );

    console.log("Conta de autenticação criada:", userCredential.user.uid);

    // Criar documento no Firestore
    await setDoc(doc(db, "usuarios", userCredential.user.uid), {
      uid: userCredential.user.uid,
      nome: adminData.nome,
      email: adminData.email,
      tipo: adminData.tipo,
      cpf: adminData.cpf,
      matricula: adminData.matricula,
      ativo: adminData.ativo,
      status: adminData.status,
      dataCriacao: new Date().toISOString()
    });

    console.log("Administrador criado com sucesso!");
    console.log("Email:", adminData.email);
    console.log("Senha:", adminData.password);
    console.log("CPF:", adminData.cpf);
    console.log("Matrícula:", adminData.matricula);
    
    process.exit(0);
  } catch (error: any) {
    console.error("Erro ao criar administrador:", error);
    
    if (error.code === "auth/email-already-in-use") {
      console.log("\nO email já está em uso. O administrador pode já existir.");
      console.log("Tente fazer login com:");
      console.log("Email:", adminData.email);
      console.log("Senha:", adminData.password);
    }
    
    process.exit(1);
  }
}

createAdmin();
