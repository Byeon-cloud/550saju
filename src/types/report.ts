import type { Timestamp } from 'firebase/firestore';

export type ReportType =
  | 'basic'
  | 'premium'
  | 'compatibility'
  | 'daeun'
  | 'yearly'
  | 'daily';

export interface ReportSection {
  id: string;
  icon: string;
  title: string;
  content: string;
  visual?: string;
}

export interface Report {
  rid: string;
  profileId: string;
  type: ReportType;

  situation?: {
    loveStatus?: string;
    jobStatus?: string;
    concern?: string;
  };

  content: {
    sections: ReportSection[];
    scores: Record<string, number>;
    summary: string;
  };

  cost: number;
  aiModel: string;
  generatedAt: Timestamp;

  shareId?: string;
  shareEnabled: boolean;

  // 궁합 전용
  partnerProfileId?: string;
  relationship?: string;
}
