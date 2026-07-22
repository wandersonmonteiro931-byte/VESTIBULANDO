import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "./portal-reference.css";
import "./features/school/school-suite.css";
import "./features/school-v2/school-os.css";

const isFirestoreError = (message: string | undefined) => {
  if (!message) return false;
  return message.includes('INTERNAL ASSERTION FAILED') || 
         message.includes('Firestore') ||
         message.includes('firebase_firestore') ||
         message.includes('__PRIVATE_') ||
         message.includes('WatchChangeAggregator') ||
         message.includes('PersistentListenStream');
};

window.addEventListener('error', (event) => {
  if (isFirestoreError(event.message) || isFirestoreError(event.error?.message) || isFirestoreError(event.error?.stack)) {
    console.warn('[Firebase] Erro interno do SDK suprimido');
    event.preventDefault();
    event.stopImmediatePropagation();
    return false;
  }
}, true);

window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  if (isFirestoreError(reason?.message) || isFirestoreError(reason?.stack) || reason?.code === 'permission-denied') {
    console.warn('[Firebase] Promise rejection suprimida');
    event.preventDefault();
    event.stopImmediatePropagation();
  }
}, true);

const originalError = console.error;
console.error = (...args: any[]) => {
  const message = args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ');
  if (isFirestoreError(message)) {
    console.warn('[Firebase] Console error suprimido');
    return;
  }
  originalError.apply(console, args);
};

createRoot(document.getElementById("root")!).render(<App />);

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((error) => console.warn("PWA indisponível:", error));
  });
}
