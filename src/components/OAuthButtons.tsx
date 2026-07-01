import { API_URL } from "../lib/api";

// Shared by Login and Signup — either page is a valid door into the same
// provider flow, which decides for itself whether it's a login or a signup.
export default function OAuthButtons() {
  return (
    <>
      <div className="flex items-center gap-3 my-1 text-[#73726c] text-[13px]">
        <div className="flex-1 h-px bg-[#e4e3de]" />
        or
        <div className="flex-1 h-px bg-[#e4e3de]" />
      </div>

      <a
        href={`${API_URL}/auth/google`}
        className="h-12 rounded-xl border border-[#e4e3de] text-[#1a1a18] text-[15px] font-medium w-full flex items-center justify-center no-underline active:scale-[0.99]"
      >
        Continue with Google
      </a>
      <a
        href={`${API_URL}/auth/apple`}
        className="h-12 rounded-xl border border-[#e4e3de] text-[#1a1a18] text-[15px] font-medium w-full flex items-center justify-center no-underline active:scale-[0.99]"
      >
        Continue with Apple
      </a>
    </>
  );
}
