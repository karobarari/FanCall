import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

// Stripe redirects here after a successful checkout. The webhook that
// actually grants the entitlement can land a beat after this redirect, so
// this polls refreshMe() briefly rather than assuming user.paid is already
// true on the first render.
const POLL_MS = 1500;
const MAX_ATTEMPTS = 8; // ~12s

export default function PaymentSuccess() {
  const navigate = useNavigate();
  const { user, refreshMe } = useAuth();
  const [attempts, setAttempts] = useState(0);

  useEffect(() => {
    if (user?.paid) {
      navigate("/app", { replace: true });
      return;
    }
    if (attempts >= MAX_ATTEMPTS) return;

    const timer = setTimeout(() => {
      refreshMe().finally(() => setAttempts((a) => a + 1));
    }, POLL_MS);
    return () => clearTimeout(timer);
  }, [user, attempts, refreshMe, navigate]);

  if (!user) return <Navigate to="/login" replace />;

  const timedOut = attempts >= MAX_ATTEMPTS;

  return (
    <div className="flex-1 flex flex-col justify-center items-center p-4 gap-3 text-center">
      <p className="text-[#1a1a18] text-[17px] font-medium m-0">
        {timedOut ? "Still confirming your payment…" : "Confirming your payment…"}
      </p>
      <p className="text-[#73726c] text-[13px] m-0 max-w-[280px]">
        {timedOut
          ? "This is taking longer than usual — refresh in a moment, or contact support if it doesn't clear up."
          : "This only takes a few seconds."}
      </p>
    </div>
  );
}
