import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function LoginScreen() {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSending(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    setSending(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setSent(true);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm text-center">
        <h1 className="font-display text-3xl text-ink">What are we wearing today?</h1>
        <p className="mt-2 text-sm text-ink-soft">
          Sign in to see your hats, projects, and tasks.
        </p>

        {sent ? (
          <p className="mt-8 text-sm text-ink-soft">
            Check <span className="font-medium text-ink">{email}</span> for a sign-in
            link.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-3">
            <Input
              type="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
            />
            <Button type="submit" disabled={sending}>
              {sending ? "Sending…" : "Send sign-in link"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
