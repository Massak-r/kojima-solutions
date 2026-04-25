import { useState } from "react";
import { useNavigate, useLocation, Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Eye, EyeOff, Lock } from "lucide-react";
import { motion } from "framer-motion";

export default function LoginPage() {
  const { isAdmin, loginAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string })?.from ?? "/space";

  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [shakeKey, setShakeKey] = useState(0);

  // Already logged in — redirect declaratively (avoids blank render)
  if (isAdmin) {
    return <Navigate to={from} replace />;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const ok = await loginAdmin(password);
    if (ok) {
      navigate(from, { replace: true });
    } else {
      setError("Incorrect password");
      setPassword("");
      setShakeKey(k => k + 1);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <motion.div
        key={shakeKey}
        animate={error ? { x: [0, -12, 12, -12, 12, 0] } : {}}
        transition={{ duration: 0.4 }}
        className="w-full max-w-sm"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-primary/10 mb-4">
            <Lock size={22} className="text-primary" />
          </div>
          <h1 className="font-display text-2xl font-bold text-foreground">
            Kojima<span className="text-primary">.</span>Space
          </h1>
          <p className="font-body text-sm text-muted-foreground mt-1">Admin access</p>
        </div>

        {/* Card */}
        <form
          onSubmit={handleSubmit}
          className="bg-card border border-border rounded-2xl p-6 shadow-card space-y-4"
        >
          <div className="relative">
            <Input
              type={showPw ? "text" : "password"}
              placeholder="Password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(""); }}
              className="pr-10 font-body"
              autoFocus
            />
            <button
              type="button"
              onClick={() => setShowPw((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              tabIndex={-1}
            >
              {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>

          {error && (
            <p className="font-body text-sm text-destructive">{error}</p>
          )}

          <Button type="submit" className="w-full font-body">
            Sign in
          </Button>
        </form>
      </motion.div>
    </div>
  );
}
