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
  // 최대 개수 제한
  const trimmed = rooms.slice(0, MAX_ROOMS);
  localStorage.setItem(CHAT_KEY, JSON.stringify(trimmed));
  scheduleChatMirror();
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
    }
    return added;
  } catch { return 0; }
}

/** 모든 채팅방 조회 (최신순) */
export function getChatRooms(): ChatRoom[] {
  return getRooms().sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
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
  return getRooms().length;
}
