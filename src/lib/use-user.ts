import { useEffect, useState } from "react";
import { currentUser, type User } from "./store";

export function useUser() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  useEffect(() => setUser(currentUser()), []);
  return [user, setUser] as const;
}
