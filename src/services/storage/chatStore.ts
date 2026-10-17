/**
 * 채팅 기록 저장소
 * 사주대화 채팅 기록을 localStorage에 보관
 *
 * 보관 정책:
 * - 채팅방 최대 30개
 * - 각 채팅방 메시지 최대 100개
 * - 90일 이상 된 채팅방은 자동 삭제 (업계 표준 30~180일)
 *
 * 비용 참고 (Firestore 기준):
 * - 10만 유저 × 10리포트 = 17.6GB → 월 $2.99 (세발의 피)
 * - 유료 리포트: 영구 보관 (계정 생존 기간)
 * - 무료 일일운세: 30일 롤링
 * - 채팅 기록: 90일 후 자동 삭제
 * - 결제 기록: 5년 보관 (전자상거래법)
 */

const CHAT_KEY = 'saju500_chats';
const MAX_ROOMS = 30;
const MAX_MESSAGES_PER_ROOM = 100;
const RETENTION_DAYS = 90;

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  keywords?: string[];
  timestamp: string; // ISO
}

export type ChatCategory = 'love' | 'career' | 'wealth' | 'free';

export interface ChatRoom {
  id: string;
  name: string;
  profileId?: string;
  category?: ChatCategory;
  lastMessage: string;
  updatedAt: string; // ISO
  messages: ChatMessage[];
  completed?: boolean;
  completedAt?: string;
  /** 2026-05-28 PM — 결과 페이지 컨텍스트 영구 저장 (sessionStorage 휘발성 보강).
   *  type/label/fullResult 포함 — AI 가 며칠 후 재진입에도 점수·섹션 등 결과 데이터 참조 가능. */
  contentContext?: {
    type: string;
    label?: string;
    fullResult?: any;
    [k: string]: any;
  };
  /** 2026-10-17 — 이 방이 누구의 사주로 답하는지 (프로필이 지워져도 다른 사람 사주로 넘어가지 않게) */
  profileSnap?: { name?: string; sajuData?: any; input?: any };
}

/** 사람이 한 번도 묻지 않은 방 (결과에서 들어왔다가 그냥 나간 방) */
function isEmptyRoom(r: ChatRoom): boolean {
  return !Array.isArray(r.messages) || !r.messages.some((m) => m.role === 'user');
}

function getRooms(): ChatRoom[] {
  try {
    const raw = localStorage.getItem(CHAT_KEY);
    if (!raw) return [];
    const rooms: ChatRoom[] = JSON.parse(raw);
    // 보관 기간 초과 자동 삭제
    const cutoff = Date.now() - RETENTION_DAYS * 86400000;
    return rooms.filter(r => new Date(r.updatedAt).getTime() > cutoff);
  } catch { return []; }
}

function saveRooms(rooms: ChatRoom[]): void {
  // 2026-10-17 — 예전엔 만든 순서대로 30개를 잘라 요즘 쓰는 옛 방이 먼저 지워졌다 → 최근에 쓴 순서로 자르고,
  //   하루 넘은 빈 방(질문 없이 나간 방)은 먼저 버린다. 저장 공간이 차도 '물어보기'가 멈추지 않게 실패를 삼킨다.
  const dayAgo = Date.now() - 86400000;
  const kept = rooms
    .filter((r) => !(isEmptyRoom(r) && new Date(r.updatedAt).getTime() < dayAgo))
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, MAX_ROOMS)
    // 결과 사본(fullResult)은 최근 12개 방만 (방마다 결과 전체를 들고 있어 저장 공간을 크게 썼다). 오래된 방은 reportId 로 찾는다
    .map((r, i) => (i < 12 || !r.contentContext?.fullResult || !r.contentContext?.reportId ? r : { ...r, contentContext: { ...r.contentContext, fullResult: undefined } }));
  try {
    localStorage.setItem(CHAT_KEY, JSON.stringify(kept));
  } catch {
    // 저장 공간 부족 — 최근 5개 방 말고는 결과 사본(fullResult)을 빼고 다시 저장
    try {
      const slim = kept.map((r, i) => (i < 5 || !r.contentContext?.fullResult ? r : { ...r, contentContext: { ...r.contentContext, fullResult: undefined } }));
      localStorage.setItem(CHAT_KEY, JSON.stringify(slim));
    } catch (e) { console.warn('[chatStore] 저장 실패', e); }
  }
  scheduleChatMirror();
  emitChatsChanged();
}

/** 대화방 목록이 바뀌었다 — 보관함, 대화 목록이 다시 읽는다 (2026-10-17) */
export const CHATS_CHANGED_EVENT = 'saju500:chats-changed';
function emitChatsChanged(): void {
  try { if (typeof window !== 'undefined') window.dispatchEvent(new Event(CHATS_CHANGED_EVENT)); } catch { /* noop */ }
}

/* ─────────────────────────────────────────────────────────────
 * 사주대화 서버 백업 (2026-10-04 · "기록 소실 절대 없게")
 *   대화는 localStorage 에만 있어 저장소가 비면 영구 소실이었다. 바뀐 방만 users/{uid}/chats/{roomId} 로
 *   올리고(3초 debounce), 저장소 초기화·계정 회전 후엔 서버에서 되받는다. 지운 대화는 삭제 기록으로 제외.
 * ──────────────────────────────────────────────────────────── */
const CHAT_DELETED_KEY = 'saju500_deleted_chat_ids';
let chatMirrorTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleChatMirror(): void {
  if (chatMirrorTimer) clearTimeout(chatMirrorTimer);
  chatMirrorTimer = setTimeout(() => {
    chatMirrorTimer = null;
    import('./firestoreSync').then((m) => m.pushChatMirror(getRooms())).catch(() => { /* 다음 변경에서 재시도 */ });
  }, 3000);
}

export function getDeletedChatIds(): Set<string> {
  try {
    const arr = JSON.parse(localStorage.getItem(CHAT_DELETED_KEY) || '[]');
    return new Set(Array.isArray(arr) ? arr.filter((x: unknown) => typeof x === 'string') : []);
  } catch { return new Set(); }
}
function addDeletedChatId(id: string): void {
  try {
    const list = Array.from(getDeletedChatIds()).filter((x) => x !== id);
    list.push(id);
    localStorage.setItem(CHAT_DELETED_KEY, JSON.stringify(list.slice(-300)));
  } catch { /* noop */ }
}

/** 서버에서 받은 대화방 병합 — 없는 방만 추가(보관 기간·삭제 기록 존중). 추가 수 반환 */
export function mergeRestoredChatRooms(incoming: ChatRoom[]): number {
  try {
    const rooms = getRooms();
    const have = new Set(rooms.map((r) => r.id));
    const deleted = getDeletedChatIds();
    const cutoff = Date.now() - RETENTION_DAYS * 86400000;
    let added = 0;
    for (const r of incoming || []) {
      if (!r?.id || have.has(r.id) || deleted.has(r.id)) continue;
      if (!Array.isArray(r.messages) || new Date(r.updatedAt).getTime() <= cutoff) continue;
      rooms.push(r); have.add(r.id); added++;
    }
    if (added > 0) {
      rooms.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      localStorage.setItem(CHAT_KEY, JSON.stringify(rooms.slice(0, MAX_ROOMS)));
      emitChatsChanged();
    }
    return added;
  } catch { return 0; }
}

/** 모든 채팅방 조회 (최신순). 2026-10-17 — 한 번도 묻지 않은 빈 방은 목록(대화 목록, 보관함)에 보이지 않는다 */
export function getChatRooms(): ChatRoom[] {
  return getRooms().filter((r) => !isEmptyRoom(r)).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

/** 특정 채팅방 조회 */
export function getChatRoom(id: string): ChatRoom | null {
  return getRooms().find(r => r.id === id) || null;
}

/** 새 채팅방 생성. 2026-05-28 PM — contentContext 영구 저장 옵션 추가 */
export function createChatRoom(
  name: string,
  category?: ChatCategory,
  contentContext?: ChatRoom['contentContext'],
): ChatRoom {
  // 2026-10-17 — 같은 결과에서 다시 '물어보기'를 누르면 새 방을 만들지 않고 그 방을 다시 연다
  //   (예전엔 누를 때마다 빈 방이 생겨 30개 상한에 진짜 대화가 밀려났다). 결과 사본은 최신으로 바꿔 둔다.
  if (contentContext?.type) {
    const key = roomKey(name, contentContext);
    const rooms = getRooms();
    const same = rooms.find((r) => !r.completed && r.contentContext?.type && roomKey(r.name, r.contentContext) === key);
    if (same) {
      same.contentContext = { ...same.contentContext, ...contentContext };
      same.updatedAt = new Date().toISOString();
      saveRooms(rooms);
      return same;
    }
  }
  const room: ChatRoom = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name,
    category: category || 'free',
    lastMessage: '',
    updatedAt: new Date().toISOString(),
    messages: [],
    ...(contentContext ? { contentContext } : {}),
  };
  const rooms = getRooms();
  rooms.unshift(room);
  saveRooms(rooms);
  return room;
}

/** 같은 결과로 만든 방인지 — 결과 id 가 있으면 그것, 없으면 종류 + 이름표 + 사람 이름 */
function roomKey(name: string, ctx: NonNullable<ChatRoom['contentContext']>): string {
  if (ctx.reportId) return `r:${ctx.reportId}`;
  // 결과 번호가 없으면 종류, 이름표, 사람, 기간, 꿈 내용, 상대, 날짜가 모두 같을 때만 같은 방 (어제 운세 방에 오늘 질문이 섞이지 않게)
  const dream = typeof ctx.dreamText === 'string' ? ctx.dreamText.slice(0, 40) : '';
  return [ctx.type, ctx.label || '', ctx.personName || name || '', ctx.periodLabel || '', dream, ctx.partnerName || '', ctx.date || ''].join('|');
}

/** 2026-10-17 — 방에 그 사람의 사주 사본을 남긴다 (프로필이 지워지거나 id 가 바뀌어도 같은 사람으로 답하게) */
export function setChatRoomProfileSnap(roomId: string, snap: { name?: string; sajuData?: any; input?: any }): void {
  if (!snap?.sajuData?.pillars) return;
  const rooms = getRooms();
  const room = rooms.find(r => r.id === roomId);
  if (!room) return;
  const prev = room.profileSnap?.sajuData?.pillars?.[2];
  const next = snap.sajuData.pillars[2];
  if (room.profileSnap && prev?.천간 === next?.천간 && prev?.지지 === next?.지지 && room.profileSnap.name === snap.name) return;
  room.profileSnap = { name: snap.name, sajuData: snap.sajuData, input: snap.input };
  saveRooms(rooms);
}

/** 2026-09-17 — 대화방 ↔ 사주 프로필 연결 저장.
 *  목록에서 방을 다시 열면 location.state 가 없어 본인 사주로 대체되던 문제 fix
 *  (친구 사주·주간/월간 결과로 시작한 방이 재진입 시 다른 사주 기준으로 답변하던 버그). */
export function setChatRoomProfileId(roomId: string, profileId: string): void {
  const rooms = getRooms();
  const room = rooms.find(r => r.id === roomId);
  if (!room || room.profileId === profileId) return;
  room.profileId = profileId;
  saveRooms(rooms);
}

/** 대화방 이름 변경 (첫 질문 기반 자동) */
export function updateRoomName(roomId: string, name: string): void {
  const rooms = getRooms();
  const room = rooms.find(r => r.id === roomId);
  if (!room) return;
  room.name = name;
  saveRooms(rooms);
}

/** 메시지 추가 */
export function addChatMessage(roomId: string, message: ChatMessage): void {
  const rooms = getRooms();
  const room = rooms.find(r => r.id === roomId);
  if (!room) return;

  room.messages.push(message);
  // 메시지 수 제한
  if (room.messages.length > MAX_MESSAGES_PER_ROOM) {
    room.messages = room.messages.slice(-MAX_MESSAGES_PER_ROOM);
  }
  room.lastMessage = message.content.slice(0, 50);
  room.updatedAt = new Date().toISOString();
  saveRooms(rooms);
}

/** 대화 마무리 */
export function completeChatRoom(roomId: string): void {
  const rooms = getRooms();
  const room = rooms.find(r => r.id === roomId);
  if (!room) return;
  room.completed = true;
  room.completedAt = new Date().toISOString();
  saveRooms(rooms);
}

/** 채팅방 삭제 */
export function deleteChatRoom(id: string): void {
  const rooms = getRooms().filter(r => r.id !== id);
  saveRooms(rooms);
  // 서버 백업도 지우고 삭제 기록 — 복원·기기 여권이 되살리지 않게 (2026-10-04)
  addDeletedChatId(id);
  import('./firestoreSync').then((m) => m.deleteChatRemote(id)).catch(() => { /* 로컬 삭제 기록이 재다운로드를 막는다 */ });
}

/** 채팅방 수 */
export function getChatRoomCount(): number {
  return getRooms().filter((r) => !isEmptyRoom(r)).length;
}
