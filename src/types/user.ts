import type { Timestamp } from 'firebase/firestore';

export type AuthProvider = 'kakao' | 'naver' | 'google' | 'toss';
export type Platform = 'web' | 'toss';

export interface User {
  uid: string;
  provider: AuthProvider;
  email?: string;
  displayName?: string;

  // 화폐 (운)
  balance: number;
  totalCharged: number;
  totalSpent: number;
  bonusBalance: number;

  // 메타
  createdAt: Timestamp;
  lastActiveAt: Timestamp;
  platform: Platform;
}

export type Relation = '본인' | '친구' | '가족' | '연인' | '기타';

export interface Profile {
  pid: string;
  name: string;
  relation: Relation;

  birthYear: number;
  birthMonth: number;
  birthDay: number;
  calendarType: 'solar' | 'lunar' | 'lunar_leap';
  gender: 'male' | 'female';

  hasBirthTime: boolean;
  birthHour?: number;
  birthMinute?: number;

  createdAt: Timestamp;
}
