import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function RegisterPage() {
  const { signUp } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirm) return setError("Passwords don't match.");
    if (password.length < 6) return setError("Password must be at least 6 characters.");
    setLoading(true);
    setError(null);
    const { error: err } = await signUp(email, password);
    setLoading(false);
    if (err) return setError(err.message);
    setSuccess(true);
  };
  return (
    <div className="min-h-screen flex w-full">
      {/* LEFT: Abstract Image Hero */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-sage-100 overflow-hidden isolate">
        <img src="/auth-hero.png" alt="Abstract Sage Silk Background" className="absolute inset-0 w-full h-full object-cover opacity-90" />
        
        {/* Decorative Overlay / Branding */}
        <div className="relative z-10 p-12 flex flex-col justify-between h-full bg-gradient-to-t from-sage-900/60 via-sage-900/20 to-transparent">
          <div className="flex items-center gap-4">
             <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-xl overflow-hidden">
                <img src="/logo.png" alt="Logo" className="w-8 h-8 object-contain drop-shadow-md pb-0.5" />
             </div>
             <span className="font-bold text-2xl text-white tracking-tight drop-shadow-sm">
               Senti<span className="text-sage-200">Mind</span>
             </span>
          </div>

          <div className="max-w-md">
             <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white text-xs font-semibold mb-4 uppercase tracking-widest">
                <span>✨</span> Private & Secure
             </div>
            <h2 className="text-4xl font-light text-white leading-tight tracking-tight mb-4 drop-shadow-sm">
              Begin your journey to <span className="font-semibold">clarity</span>
            </h2>
            <p className="text-sage-50 text-lg font-light drop-shadow-sm">
              Create your completely private mental health vault and unlock intelligent insights into your daily emotional patterns.
            </p>
          </div>
        </div>
      </div>

      {/* RIGHT: Register Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center bg-white px-6 py-12 lg:px-16 overflow-y-auto">
        <div className="w-full max-w-md animate-medical-slide-up">
          {/* Mobile Logo Fallback */}
          <div className="lg:hidden flex items-center gap-4 mb-10">
             <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center border border-sage-100 shadow-sm overflow-hidden">
                <img src="/logo.png" alt="Logo" className="w-full h-full object-cover p-1" />
             </div>
             <span className="font-bold text-xl text-warm-800 tracking-tight">
               Senti<span className="text-sage-600">Mind</span>
             </span>
          </div>

          {success ? (
            <div className="text-center py-6">
              <div className="w-20 h-20 mx-auto rounded-full bg-sage-100 flex items-center justify-center text-4xl mb-6 shadow-inner border border-sage-200">
                📬
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-warm-800 mb-2">Check your email</h2>
              <p className="text-warm-500 text-sm mb-8 leading-relaxed">
                We've securely sent a verification link to <br/><strong className="text-sage-700">{email}</strong>. 
                Click it to activate your vault.
              </p>
              <Link to="/login" className="medical-btn medical-btn-primary w-full py-2.5 text-base shadow-medical">
                Return to Sign In
              </Link>
            </div>
          ) : (
            <>
              <h2 className="text-3xl font-bold tracking-tight text-warm-800 mb-2">Create account</h2>
              <p className="text-warm-500 mb-8 font-medium">Join SentiMind. Your data is strictly yours.</p>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="medical-label block mb-1.5" htmlFor="reg-email">Email</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com" required className="medical-input bg-sage-50/30 focus:bg-white" id="reg-email" />
                </div>
                <div>
                  <label className="medical-label block mb-1.5" htmlFor="reg-password">Password</label>
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                    placeholder="Min 6 characters" required className="medical-input bg-sage-50/30 focus:bg-white" id="reg-password" />
                </div>
                <div>
                  <label className="medical-label block mb-1.5" htmlFor="reg-confirm">Confirm Password</label>
                  <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
                    placeholder="••••••••" required className="medical-input bg-sage-50/30 focus:bg-white" id="reg-confirm" />
                </div>

                {error && (
                  <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm flex gap-2">
                    <span>⚠️</span> {error}
                  </div>
                )}

                <button type="submit" disabled={loading} className="medical-btn medical-btn-primary w-full py-2.5 text-base shadow-medical-md mt-4">
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Creating account...
                    </span>
                  ) : "Create Account"}
                </button>
              </form>
              
              <p className="text-center text-sm text-warm-500 mt-8">
                Already have an account?{" "}
                <Link to="/login" className="text-sage-600 font-semibold hover:text-sage-800 transition-colors">Sign in</Link>
              </p>
              
              <div className="mt-12 text-center flex items-center justify-center gap-2 text-xs text-warm-400 font-medium">
                 <span>🔒</span> E2E encryption enabled by default.
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
