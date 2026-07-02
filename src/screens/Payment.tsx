import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { apiPost } from "../lib/api";

// Demo-only "checkout" — no Stripe SDK, no real charge (roadmap step 18
// replaces this). Exists so the full loop — signup, pay, predict — can be
// tested end to end before a real payment processor is wired up.
export default function Payment() {
  const navigate = useNavigate();
  const { user, refreshMe } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!user) return <Navigate to="/login" replace />;
  if (user.paid) return <Navigate to="/app" replace />;

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      await apiPost("/payment/pay", {});
      await refreshMe();
      navigate("/app");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex-1 flex flex-col justify-center p-4 gap-3">
      <p className="text-center text-[#1a1a18] text-[17px] font-medium mt-2 mb-1">
        One more step
      </p>
      <p className="text-center text-[#73726c] text-[13px] mb-3">
        Subscribe to start predicting for Manchester City.
      </p>

      <div className="border border-[#e4e3de] rounded-xl p-4 flex flex-col gap-1">
        <span className="text-[13px] text-[#73726c]">Monthly plan</span>
        <span className="text-[28px] font-bold text-[#1a1a18]">
          £4.99<span className="text-[15px] font-normal text-[#73726c]">/mo</span>
        </span>
        <span className="text-[12px] text-[#73726c] mt-2">
          Demo only — no card will be charged.
        </span>
      </div>

      {error && (
        <p className="text-[#c0392b] text-center text-[13px] m-0">{error}</p>
      )}

      <button
        className="h-12 rounded-xl bg-[#0f6e56] text-white border-0 text-[15px] font-medium cursor-pointer w-full active:scale-[0.99]"
        disabled={busy}
        onClick={submit}
      >
        {busy ? "Processing…" : "Pay & Continue"}
      </button>
    </div>
  );
}
