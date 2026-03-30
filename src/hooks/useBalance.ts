import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/services/auth/firebase';
import { useAuth } from './useAuth';

export function useBalance() {
  const { user } = useAuth();
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setBalance(0);
      setLoading(false);
      return;
    }

    const unsubscribe = onSnapshot(doc(db, 'users', user.uid), (snap) => {
      if (snap.exists()) {
        setBalance((snap.data().balance as number) ?? 0);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, [user]);

  return { balance, loading };
}
