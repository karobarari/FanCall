import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { apiGet, apiPost } from "../lib/api";

interface Plan {
  id: string;
  channel: "direct" | "subscription";
  price_pence: number;
  currency: string;
  billing_interval: "one_time" | "monthly";
}

function formatPrice(pricePence: number, currency: string): string {
  const amount = (pricePence / 100).toFixed(2);
  return currency.toUpperCase() === "GBP" ? `£${amount}` : `${amount} ${currency.toUpperCase()}`;
}

export default function Payment() {
  const navigate = useNavigate();
  const { user, refreshMe } = useAuth();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    apiGet<{ plans: Plan[] }>("/payment/plans")
      .then((data) => setPlans(data.plans))
      .catch(() => {
        // Left empty — the demo fallback below covers this either way.
      })
      .finally(() => setPlansLoading(false));
  }, []);

  if (!user) return <Navigate to="/login" replace />;
  if (user.paid) return <Navigate to="/app" replace />;

  async function checkout(channel: "direct" | "subscription") {
    setError(null);
    setBusy(true);
    try {
      const { url } = await apiPost<{ url: string }>("/payment/checkout", { channel });
      window.location.href = url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setBusy(false);
    }
  }

  async function demoPay() {
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

  async function redeem() {
    setError(null);
    setBusy(true);
    try {
      await apiPost("/payment/redeem", { code });
      await refreshMe();
      navigate("/app");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  const directPlan = plans.find((p) => p.channel === "direct");
  const subscriptionPlan = plans.find((p) => p.channel === "subscription");
  const hasRealPlans = Boolean(directPlan || subscriptionPlan);

  return (
    <div className="flex-1 flex flex-col justify-center p-4 gap-3">
      <p className="text-center text-[#1a1a18] text-[17px] font-medium mt-2 mb-1">
        One more step
      </p>
      <p className="text-center text-[#73726c] text-[13px] mb-3">
        Subscribe to start predicting for {user.team_name}.
      </p>

      {!plansLoading && hasRealPlans ? (
        <div className="flex flex-col gap-2.5">
          {subscriptionPlan && (
            <div className="border border-[#e4e3de] rounded-xl p-4 flex flex-col gap-1">
              <span className="text-[13px] text-[#73726c]">Monthly plan</span>
              <span className="text-[28px] font-bold text-[#1a1a18]">
                {formatPrice(subscriptionPlan.price_pence, subscriptionPlan.currency)}
                <span className="text-[15px] font-normal text-[#73726c]">/mo</span>
              </span>
              <button
                className="h-11 mt-1 rounded-xl bg-[#0f6e56] text-white border-0 text-[15px] font-medium cursor-pointer active:scale-[0.99]"
                disabled={busy}
                onClick={() => checkout("subscription")}
              >
                Subscribe
              </button>
            </div>
          )}
          {directPlan && (
            <div className="border border-[#e4e3de] rounded-xl p-4 flex flex-col gap-1">
              <span className="text-[13px] text-[#73726c]">Season pass</span>
              <span className="text-[28px] font-bold text-[#1a1a18]">
                {formatPrice(directPlan.price_pence, directPlan.currency)}
              </span>
              <button
                className="h-11 mt-1 rounded-xl border border-[#0f6e56] text-[#0f6e56] bg-white text-[15px] font-medium cursor-pointer active:scale-[0.99]"
                disabled={busy}
                onClick={() => checkout("direct")}
              >
                Pay once
              </button>
            </div>
          )}
        </div>
      ) : (
        !plansLoading && (
          <div className="border border-[#e4e3de] rounded-xl p-4 flex flex-col gap-1">
            <span className="text-[13px] text-[#73726c]">Monthly plan</span>
            <span className="text-[28px] font-bold text-[#1a1a18]">
              £4.99<span className="text-[15px] font-normal text-[#73726c]">/mo</span>
            </span>
            <span className="text-[12px] text-[#73726c] mt-2">
              Demo only — no card will be charged.
            </span>
            <button
              className="h-12 mt-2 rounded-xl bg-[#0f6e56] text-white border-0 text-[15px] font-medium cursor-pointer w-full active:scale-[0.99]"
              disabled={busy}
              onClick={demoPay}
            >
              {busy ? "Processing…" : "Pay & Continue"}
            </button>
          </div>
        )
      )}

      {error && (
        <p className="text-[#c0392b] text-center text-[13px] m-0">{error}</p>
      )}

      <div className="border-t border-[#e4e3de] mt-2 pt-3 flex flex-col gap-2">
        <span className="text-[12px] text-[#73726c] text-center">
          Have a season-ticket code from your club?
        </span>
        <div className="flex gap-2">
          <input
            className="h-11 flex-1 border border-[#e4e3de] rounded-xl px-3 text-[15px] text-[#1a1a18] bg-white box-border placeholder:text-[#73726c]"
            placeholder="Enter code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <button
            className="h-11 px-4 rounded-xl border border-[#e4e3de] text-[#1a1a18] bg-white text-[14px] font-medium cursor-pointer disabled:opacity-60"
            disabled={busy || !code}
            onClick={redeem}
          >
            Redeem
          </button>
        </div>
      </div>
    </div>
  );
}
