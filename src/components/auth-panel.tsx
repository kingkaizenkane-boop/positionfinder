import { useState } from "react";
import { lovable } from "@/integrations/lovable";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AuthPanel() {
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setMessage("");
    const result = mode === "sign-in"
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } });
    setBusy(false);
    if (result.error) {
      setMessage(result.error.message);
      return;
    }
    if (mode === "sign-up" && !result.data.session) {
      setMessage("Check your email to confirm your account, then return here to sign in.");
    }
  };

  const signInWithGoogle = async () => {
    setBusy(true);
    setMessage("");
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (result.error) setMessage(result.error instanceof Error ? result.error.message : String(result.error));
    setBusy(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <Card className="w-full max-w-md border-primary/20">
        <CardHeader>
          <CardTitle>{mode === "sign-in" ? "Sign in to PositionFinder" : "Create your PositionFinder account"}</CardTitle>
          <p className="text-sm text-muted-foreground">Sign in to use saved analyses, imports, and historical records.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="auth-email">Email</Label>
            <Input id="auth-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="auth-password">Password</Label>
            <Input id="auth-password" type="password" autoComplete={mode === "sign-in" ? "current-password" : "new-password"} value={password} onChange={(event) => setPassword(event.target.value)} />
          </div>
          <Button className="w-full" onClick={() => void submit()} disabled={busy || !email || !password}>
            {mode === "sign-in" ? "Sign in" : "Create account"}
          </Button>
          <Button variant="outline" className="w-full" onClick={() => void signInWithGoogle()} disabled={busy}>
            Continue with Google
          </Button>
          {message && <p className="text-sm text-muted-foreground" role="status">{message}</p>}
          <button className="w-full text-sm text-primary underline-offset-4 hover:underline" onClick={() => { setMode(mode === "sign-in" ? "sign-up" : "sign-in"); setMessage(""); }}>
            {mode === "sign-in" ? "Need an account? Create one" : "Already have an account? Sign in"}
          </button>
        </CardContent>
      </Card>
    </div>
  );
}