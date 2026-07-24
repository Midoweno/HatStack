import { useEffect, useState } from "react";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [event, setEvent] = useState<AuthChangeEvent | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((evt, s) => {
      setEvent(evt);
      setSession(s);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  return { session, loading, event };
}
