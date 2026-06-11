// Telegram Bot API 공용 헬퍼
const API = (token: string) => `https://api.telegram.org/bot${token}`;

export interface InlineButton {
  text: string;
  callback_data: string;
}

async function tg(token: string, method: string, payload: unknown): Promise<any> {
  const res = await fetch(`${API(token)}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => ({}));
  if (!body.ok) {
    console.error(`Telegram ${method} 실패:`, JSON.stringify(body));
  }
  return body;
}

export function sendMessage(
  token: string,
  chatId: number | string,
  text: string,
  buttons?: InlineButton[][],
): Promise<any> {
  return tg(token, "sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    ...(buttons ? { reply_markup: { inline_keyboard: buttons } } : {}),
  });
}

export function editMessageText(
  token: string,
  chatId: number | string,
  messageId: number,
  text: string,
  buttons?: InlineButton[][],
): Promise<any> {
  return tg(token, "editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    reply_markup: buttons ? { inline_keyboard: buttons } : { inline_keyboard: [] },
  });
}

export function editMessageReplyMarkup(
  token: string,
  chatId: number | string,
  messageId: number,
  buttons: InlineButton[][],
): Promise<any> {
  return tg(token, "editMessageReplyMarkup", {
    chat_id: chatId,
    message_id: messageId,
    reply_markup: { inline_keyboard: buttons },
  });
}

export function answerCallbackQuery(
  token: string,
  callbackQueryId: string,
  text?: string,
): Promise<any> {
  return tg(token, "answerCallbackQuery", {
    callback_query_id: callbackQueryId,
    ...(text ? { text } : {}),
  });
}

/** HTML 특수문자 escape (parse_mode=HTML 안전) */
export function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** 발행 대상 라벨 */
export function targetLabel(targets: string[]): string {
  const t = new Set(targets);
  if (t.has("threads") && t.has("x")) return "📤 Threads+X";
  if (t.has("x")) return "📤 X만";
  return "📤 Threads";
}

/** 승인/예약 버튼 (callback_data 형식: act:postId) — webhook 의 handleCallback 과 1:1 */
export function buildApproveButtons(postId: string, targets: string[] = ["threads"]): InlineButton[][] {
  return [
    [
      { text: "✅ 지금 발행", callback_data: `now:${postId}` },
      { text: "⏰ 1시간 뒤", callback_data: `1h:${postId}` },
    ],
    [
      { text: "⏰ 3시간 뒤", callback_data: `3h:${postId}` },
      { text: "⏰ 내일 오전 9시", callback_data: `9am:${postId}` },
    ],
    [
      { text: targetLabel(targets) + " (탭=변경)", callback_data: `tgt:${postId}` },
    ],
    [
      { text: "🔄 다시 뽑기", callback_data: `regen:${postId}` },
      { text: "❌ 취소", callback_data: `cancel:${postId}` },
    ],
  ];
}
