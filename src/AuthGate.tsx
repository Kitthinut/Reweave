import { createContext, useContext, useEffect, useState, type FormEvent, type ReactNode } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  updateProfile,
  signOut,
  type User,
} from "firebase/auth";
import { auth } from "./firebase";

type AuthValue = { user: User; logout: () => void };
const AuthContext = createContext<AuthValue | null>(null);

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthGate>");
  return ctx;
}

const ERRORS: Record<string, string> = {
  "auth/invalid-credential": "Email or password is incorrect.",
  "auth/invalid-email": "That email address doesn’t look right.",
  "auth/email-already-in-use": "An account with this email already exists.",
  "auth/weak-password": "Password must be at least 6 characters.",
  "auth/too-many-requests": "Too many attempts. Please wait a bit and try again.",
  "auth/network-request-failed": "Network problem. Check your connection.",
};
const THAI_ERRORS: Record<string, string> = {
  "auth/invalid-credential": "อีเมลหรือรหัสผ่านไม่ถูกต้อง",
  "auth/invalid-email": "รูปแบบอีเมลไม่ถูกต้อง",
  "auth/email-already-in-use": "มีบัญชีที่ใช้อีเมลนี้อยู่แล้ว",
  "auth/weak-password": "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร",
  "auth/too-many-requests": "พยายามเข้าสู่ระบบหลายครั้งเกินไป โปรดรอสักครู่แล้วลองใหม่",
  "auth/network-request-failed": "การเชื่อมต่อเครือข่ายมีปัญหา โปรดตรวจสอบอินเทอร์เน็ต",
};

export default function AuthGate({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<"en" | "th">(() => localStorage.getItem("reweave-language") === "th" ? "th" : "en");
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(
    () =>
      onAuthStateChanged(auth, (u) => {
        setUser(u);
        setChecking(false);
      }),
    [],
  );

  useEffect(() => {
    localStorage.setItem("reweave-language", lang);
    document.documentElement.lang = lang;
  }, [lang]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setBusy(true); // keeps the form on screen until signup finishes (so the display name is saved first)
    try {
      if (mode === "signup") {
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        await updateProfile(cred.user, { displayName: name.trim() || email.split("@")[0] });
        sendEmailVerification(cred.user).catch(() => {});
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      }
    } catch (e: any) {
      const code = e?.code as string | undefined;
      setError(lang === "th"
        ? (code ? THAI_ERRORS[code] : undefined) ?? "เกิดข้อผิดพลาด โปรดลองอีกครั้ง"
        : (code ? ERRORS[code] : undefined) ?? "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  if (checking) return <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", color: "var(--ink-soft)" }}>{lang === "th" ? "กำลังโหลด…" : "Loading…"}</div>;

  if (user && !busy) {
    return <AuthContext.Provider value={{ user, logout: () => signOut(auth) }}>{children}</AuthContext.Provider>;
  }

  const field = { width: "100%", padding: "12px 14px", borderRadius: 12, border: "1px solid var(--line)", background: "var(--white)", color: "var(--ink)", font: "inherit" } as const;

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "var(--cream)", padding: 20 }}>
      <form onSubmit={submit} style={{ width: "min(400px, 100%)", background: "var(--paper)", borderRadius: 24, padding: 28, boxShadow: "var(--shadow)", display: "grid", gap: 14, color: "var(--ink)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h1 style={{ margin: 0, fontSize: 28 }}>reweave</h1>
          <button type="button" className="language-button" onClick={() => setLang((current) => current === "en" ? "th" : "en")} aria-label={lang === "th" ? "เปลี่ยนภาษา" : "Change language"}>{lang === "th" ? "ภาษาอังกฤษ" : "ไทย"}</button>
        </div>
        <p style={{ margin: 0, color: "var(--ink-soft)" }}>{mode === "login" ? (lang === "th" ? "ยินดีต้อนรับกลับมา ต้นฝ้ายของคุณรออยู่นะ" : "Welcome back. Your cotton misses you.") : (lang === "th" ? "สร้างบัญชีแล้วเริ่มปลูกต้นฝ้ายของคุณ" : "Create an account and plant your cotton.")}</p>
        {mode === "signup" && <input style={field} placeholder={lang === "th" ? "ชื่อที่ใช้แสดง" : "Display name"} value={name} onChange={(e) => setName(e.target.value)} required />}
        <input style={field} type="email" placeholder={lang === "th" ? "อีเมล" : "Email"} value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        <input style={field} type="password" placeholder={lang === "th" ? "รหัสผ่าน (อย่างน้อย 6 ตัวอักษร)" : "Password (6+ characters)"} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} autoComplete={mode === "login" ? "current-password" : "new-password"} />
        {error && <div role="alert" style={{ color: "#b3261e", fontSize: 14 }}>{error}</div>}
        <button className="primary-button" type="submit" disabled={busy}>{busy ? (lang === "th" ? "กรุณารอสักครู่…" : "Please wait…") : mode === "login" ? (lang === "th" ? "เข้าสู่ระบบ" : "Log in") : (lang === "th" ? "สมัครสมาชิก" : "Sign up")}</button>
        <button type="button" className="secondary-button" onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(""); }}>
          {mode === "login" ? (lang === "th" ? "ยังไม่มีบัญชีใช่ไหม? สมัครสมาชิก" : "New here? Create an account") : (lang === "th" ? "มีบัญชีอยู่แล้ว? เข้าสู่ระบบ" : "Already have an account? Log in")}
        </button>
      </form>
    </div>
  );
}