"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { loginUser } from "@/lib/authService";
import { Eye, EyeOff, LogIn, AlertCircle, Shield } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [loading, setLoading]   = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { setError("ກະລຸນາໃສ່ Email ແລະ Password"); return; }
    setLoading(true);
    setError(null);
    try {
      await loginUser(email, password);
      router.replace("/dashboard");
    } catch (err: unknown) {
      const msg = (err as Error).message || "";
      if (msg.includes("invalid-credential") || msg.includes("wrong-password") || msg.includes("user-not-found")) {
        setError("Email ຫຼື Password ບໍ່ຖືກຕ້ອງ");
      } else if (msg.includes("ຖືກປິດ")) {
        setError(msg);
      } else {
        setError("ເຂົ້າສູ່ລະບົບບໍ່ສໍາເລັດ: " + msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">

      {/* Background decorative circles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-slate-800/30 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">

        {/* Card */}
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl overflow-hidden">

          {/* Top accent bar */}
          <div className="h-1 bg-gradient-to-r from-blue-500 via-blue-400 to-blue-600" />

          <div className="p-8">

            {/* Logo + Title */}
            <div className="flex flex-col items-center mb-8">
              <div className="w-16 h-16 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/30 mb-4 overflow-hidden">
                <img
                  src="/sokxay.png"
                  alt="Sokxay Logo"
                  className="w-16 h-16 object-contain"
                  onError={(e) => {
                    const el = e.currentTarget as HTMLImageElement;
                    el.style.display = "none";
                    el.parentElement!.innerHTML = `<span class="text-white text-xl font-bold">S+</span>`;
                  }}
                />
              </div>
              <h1 className="text-xl font-bold text-slate-800">Sokxay One Plus</h1>
              <p className="text-sm text-slate-500 mt-1">Issue Tracker · ເຂົ້າສູ່ລະບົບ</p>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2.5 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-5 text-sm text-red-700">
                <AlertCircle size={16} className="shrink-0" />
                {error}
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">

              {/* Email */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@example.com"
                  autoComplete="email"
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-slate-50 placeholder-slate-300 transition-all"
                  required
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPwd ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 pr-11 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-slate-50 placeholder-slate-300 transition-all"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd(!showPwd)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition-all shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed mt-2"
              >
                {loading ? (
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="32" strokeDashoffset="12" />
                  </svg>
                ) : (
                  <LogIn size={16} />
                )}
                {loading ? "ກໍາລັງເຂົ້າສູ່ລະບົບ..." : "ເຂົ້າສູ່ລະບົບ"}
              </button>
            </form>

            {/* Footer note */}
            <div className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-400">
              <Shield size={12} />
              <span>ລະບົບຮັກສາຄວາມປອດໄພດ້ວຍ Firebase Auth</span>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-slate-500 mt-5">
          © 2026 Sokxay One Plus · Issue Tracker System
        </p>
      </div>
    </div>
  );
}
