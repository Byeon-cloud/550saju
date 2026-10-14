"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fsSafe = fsSafe;
exports.setReportSafe = setReportSafe;
const MAX_DEPTH = 18;
function fsSafe(v) {
    const walk = (x, depth, inArray) => {
        if (x === undefined)
            return null;
        if (Array.isArray(x)) {
            if (inArray)
                return JSON.stringify(x); // 배열 안 배열
            return x.map((y) => walk(y, depth + 1, true));
        }
        if (x && typeof x === 'object' && Object.getPrototypeOf(x) === Object.prototype) {
            if (depth >= MAX_DEPTH)
                return JSON.stringify(x);
            const o = {};
            for (const [k, y] of Object.entries(x)) {
                if (!k || /^__.*__$/.test(k) || y === undefined)
                    continue;
                o[k] = walk(y, depth + 1, false);
            }
            return o;
        }
        return x;
    };
    try {
        return walk(v, 0, false);
    }
    catch {
        return v;
    }
}
/** 리포트 사본 저장 — content 는 fsSafe 로 정리, 그래도 실패하면 contentJson 글자 사본. 예외를 던지지 않는다 */
async function setReportSafe(ref, data, options) {
    const put = (d) => (options ? ref.set(d, options) : ref.set(d));
    try {
        await put('content' in data ? { ...data, content: fsSafe(data.content) } : data);
        return;
    }
    catch (e) {
        console.error('[setReportSafe] 저장 실패 → 글자 사본으로 다시:', ref.path, e?.message);
    }
    try {
        const { content, ...rest } = data;
        await put({ ...rest, contentJson: JSON.stringify(content ?? null) });
    }
    catch (e2) {
        console.error('[setReportSafe] 글자 사본도 실패:', ref.path, e2?.message);
    }
}
//# sourceMappingURL=firestoreSafe.js.map