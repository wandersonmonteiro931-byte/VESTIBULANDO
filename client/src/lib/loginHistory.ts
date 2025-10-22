import { collection, addDoc } from "firebase/firestore";
import { db } from "./firebase";
import type { InsertLoginHistory } from "@shared/schema";

// Função para converter timestamp para horário de Brasília (UTC-3)
export function toBrasiliaTime(date: Date = new Date()): string {
  // Converter para UTC-3 (horário de Brasília)
  const brasiliaOffset = -3 * 60; // -3 horas em minutos
  const utcTime = date.getTime() + (date.getTimezoneOffset() * 60000);
  const brasiliaTime = new Date(utcTime + (brasiliaOffset * 60000));
  
  return brasiliaTime.toISOString();
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
