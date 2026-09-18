import { apiUrl } from "@/const";

export default function GoogleSignInButton({ returnTo }: { returnTo: string }) {
  const startGoogleLogin = () => {
    const destination = returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/profile";
    window.location.assign(`${apiUrl("/api/auth/google/start")}?returnTo=${encodeURIComponent(destination)}`);
  };

  return (
    <button className="button button-primary google-login-button" type="button" onClick={startGoogleLogin}>
      Continue with Google
    </button>
  );
}
