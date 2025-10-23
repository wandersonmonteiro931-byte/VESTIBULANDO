import { collection, addDoc } from "firebase/firestore";
import { db } from "./firebase";
import type { InsertLoginHistory } from "@shared/schema";
import { toBrasiliaTime as toBrasiliaTimeUtil } from "./brasiliaTime";

// Re-exportar a função do utilitário principal
export function toBrasiliaTime(date: Date = new Date()): string {
  return toBrasiliaTimeUtil(date);
}

// Registrar login do usuário
export async function registerLogin(
  userId: string,
  userNome: string,
  userTipo: "aluno" | "professor" | "diretor"
) {
  try {
    const loginData: InsertLoginHistory = {
      userId,
      userNome,
      userTipo,
      action: "login",
      timestamp: toBrasiliaTime(),
      userAgent: navigator.userAgent,
    };

    await addDoc(collection(db, "loginHistory"), loginData);
    console.log("Login registrado:", loginData);
  } catch (error) {
    console.error("Erro ao registrar login:", error);
  }
}

// Registrar logout do usuário
export async function registerLogout(
  userId: string,
  userNome: string,
  userTipo: "aluno" | "professor" | "diretor"
) {
  try {
    const logoutData: InsertLoginHistory = {
      userId,
      userNome,
      userTipo,
      action: "logout",
      timestamp: toBrasiliaTime(),
      userAgent: navigator.userAgent,
    };

    await addDoc(collection(db, "loginHistory"), logoutData);
    console.log("Logout registrado:", logoutData);
  } catch (error) {
    console.error("Erro ao registrar logout:", error);
  }
}
