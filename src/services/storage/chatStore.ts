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

export interface ChatRoom {
  id: string;
  name: string; // 사주 프로필 이름 또는 "새 대화"
  lastMessage: string;
  updatedAt: string; // ISO
  messages: ChatMessage[];
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
}

/** 모든 채팅방 조회 (최신순) */
export function getChatRooms(): ChatRoom[] {
  return getRooms().sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

/** 특정 채팅방 조회 */
export function getChatRoom(id: string): ChatRoom | null {
  return getRooms().find(r => r.id === id) || null;
}

/** 새 채팅방 생성 */
export function createChatRoom(name: string): ChatRoom {
  const room: ChatRoom = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name,
    lastMessage: '',
    updatedAt: new Date().toISOString(),
    messages: [],
  };
  const rooms = getRooms();
  rooms.unshift(room);
  saveRooms(rooms);
  return room;
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

/** 채팅방 삭제 */
export function deleteChatRoom(id: string): void {
  const rooms = getRooms().filter(r => r.id !== id);
  saveRooms(rooms);
}

/** 채팅방 수 */
export function getChatRoomCount(): number {
  return getRooms().length;
}
