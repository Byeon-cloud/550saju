import { useState, useEffect, useRef } from "react";
import * as recharts from "recharts";
const { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer } = recharts;

// ─── CONFIG: 시간 입력 여부 ───
const HAS_TIME = true; // false면 시주 미입력 UI

// ─── 데이터 ───
const SAJU = {
  name: "준기",
  birth: "1998년 3월 3일",
  birthTime: HAS_TIME ? "새벽 5시 (묘시)" : null,
  lunarBirth: "음력 2월 5일",
  gender: "남",
  zodiac: "호랑이띠",
  pillars: [
    { label: "년주", sub: "年柱", gH: "戊", jH: "寅", gKr: "무", jKr: "인", gE: "earth", jE: "wood", gM: "토", jM: "목", gSip: "겁재", jSip: "정관·정인·겁재", desc: "조상·사회·어린시절" },
    { label: "월주", sub: "月柱", gH: "甲", jH: "寅", gKr: "갑", jKr: "인", gE: "wood", jE: "wood", gM: "목", jM: "목", gSip: "정관", jSip: "정관·정인·겁재", desc: "부모·직장·청년기" },
    { label: "일주", sub: "日柱", gH: "己", jH: "酉", gKr: "기", jKr: "유", gE: "earth", jE: "metal", gM: "토", jM: "금", gSip: "일주(나)", jSip: "식신", desc: "나·배우자·중년기", isMe: true },
    HAS_TIME
      ? { label: "시주", sub: "時柱", gH: "丁", jH: "卯", gKr: "정", jKr: "묘", gE: "fire", jE: "wood", gM: "화", jM: "목", gSip: "편인", jSip: "칠살", desc: "자녀·말년·결과물" }
      : { label: "시주", sub: "時柱", empty: true, desc: "자녀·말년·결과물" },
  ],
  elements: HAS_TIME
    ? { wood: 88, fire: 35, earth: 50, metal: 18, water: 0 }
    : { wood: 85, fire: 25, earth: 55, metal: 20, water: 0 },
  scores: { career: 78, love: 65, wealth: 72, social: 70, health: 58, potential: 88 },
  daeun: [
    { age: "2~11세", gz: "乙卯", kr: "을묘", elem: "wood", label: "성장기", period: "1999~2008" },
    { age: "12~21세", gz: "丙辰", kr: "병진", elem: "fire", label: "학업기", period: "2009~2018" },
    { age: "22~31세", gz: "丁巳", kr: "정사", elem: "fire", label: "현재", current: true, period: "2019~2028" },
    { age: "32~41세", gz: "戊午", kr: "무오", elem: "earth", label: "안정기", period: "2029~2038" },
    { age: "42~51세", gz: "己未", kr: "기미", elem: "earth", label: "확립기", period: "2039~2048" },
    { age: "52~61세", gz: "庚申", kr: "경신", elem: "metal", label: "수확기", period: "2049~2058" },
  ],
  unyoung12: [
    { pillar: "년지 寅(인)", value: "死", kr: "사", color: "#e74c3c", meaning: "에너지가 내면으로 수렴. 겉으로 과시하기보다 내면의 깊이를 추구합니다." },
    { pillar: "월지 寅(인)", value: "死", kr: "사", color: "#e74c3c", meaning: "직장·사회에서도 내면 지향. 겉으로 드러내지 않는 실력자 타입." },
    { pillar: "일지 酉(유)", value: "長生", kr: "장생", color: "#27ae60", meaning: "본질에서는 생명력이 넘침! 끊임없이 새로운 것을 만들어내는 에너지." },
    ...(HAS_TIME ? [{ pillar: "시지 卯(묘)", value: "病", kr: "병", color: "#e67e22", meaning: "결과물·말년 영역의 에너지가 약해지는 단계. 건강 관리와 무리하지 않는 페이스 조절이 중요." }] : []),
  ],
  napeum: [
    { pillar: "년주", hanja: "城头土", kr: "성두토", icon: "🏯", desc: "성벽 위의 흙 — 높은 곳에서 넓게 바라보는 시야" },
    { pillar: "월주", hanja: "大溪水", kr: "대계수", icon: "🏞️", desc: "큰 계곡의 물 — 깊고 맑으며 끊임없이 흐르는 지혜" },
    { pillar: "일주", hanja: "大驿土", kr: "대역토", icon: "🛤️", desc: "역참의 넓은 땅 — 많은 사람이 오가며 인연이 풍부" },
    ...(HAS_TIME ? [{ pillar: "시주", hanja: "炉中火", kr: "노중화", icon: "🔥", desc: "화로 안의 불 — 내면에 숨겨진 뜨거운 열정과 창작의 불꽃" }] : []),
  ],
  gilsin: [
    { hanja: "天恩", kr: "천은", desc: "위기 때 예상 못한 도움이 들어옴" },
    { hanja: "阴德", kr: "음덕", desc: "남몰래 베푼 선행이 돌아오는 기운" },
    { hanja: "福生", kr: "복생", desc: "자연스럽게 복이 따르는 체질" },
    { hanja: "除神", kr: "제신", desc: "장애물을 제거하는 힘" },
    { hanja: "鸣吠", kr: "명폐", desc: "말과 글로 영향력을 발휘" },
  ],
  hyungsal: [
    { hanja: "天吏", kr: "천리", desc: "계약·문서를 꼼꼼히 확인할 것" },
    { hanja: "五虚", kr: "오허", desc: "체력 관리와 내실 다지기 중요" },
    { hanja: "五离", kr: "오리", desc: "관계에서 소통 노력 필요" },
    { hanja: "元武", kr: "원무", desc: "속마음을 여는 연습이 과제" },
  ],
  gongmang: [
    { basis: "년주 공망", value: "申酉", kr: "신유 (금)", meaning: "사회적 인정이 늦게 오지만, 꾸준히 쌓으면 한꺼번에 돌아옴" },
    { basis: "일주 공망", value: "寅卯", kr: "인묘 (목)", meaning: "남의 기대에 매이지 말 것. 자기 창작에 집중할 때 인생이 풀림" },
  ],
};

const EC = {
  wood: { main: "#2d8a4e", light: "#e8f5e9", med: "#a5d6a7", dark: "#1b5e20", grad: "linear-gradient(135deg,#e8f5e9,#c8e6c9)" },
  fire: { main: "#d32f2f", light: "#ffebee", med: "#ef9a9a", dark: "#b71c1c", grad: "linear-gradient(135deg,#ffebee,#ffcdd2)" },
  earth: { main: "#f57f17", light: "#fff8e1", med: "#ffe082", dark: "#e65100", grad: "linear-gradient(135deg,#fff8e1,#ffecb3)" },
  metal: { main: "#757575", light: "#f5f5f5", med: "#e0e0e0", dark: "#424242", grad: "linear-gradient(135deg,#f5f5f5,#e0e0e0)" },
  water: { main: "#1565c0", light: "#e3f2fd", med: "#90caf9", dark: "#0d47a1", grad: "linear-gradient(135deg,#e3f2fd,#bbdefb)" },
};
const EKR = { wood: "목(木)", fire: "화(火)", earth: "토(土)", metal: "금(金)", water: "수(水)" };
const EEMO = { wood: "🌳", fire: "🔥", earth: "⛰️", metal: "⚔️", water: "💧" };

// ─── 유틸 ───
function useInView(t = 0.15) {
  const ref = useRef(null);
  const [v, setV] = useState(false);
  useEffect(() => { const el = ref.current; if (!el) return; const o = new IntersectionObserver(([e]) => { if (e.isIntersecting) setV(true); }, { threshold: t }); o.observe(el); return () => o.disconnect(); }, [t]);
  return [ref, v];
}
function AnimNum({ target }) {
  const [val, setVal] = useState(0);
  const [ref, vis] = useInView(0.3);
  const ran = useRef(false);
  useEffect(() => { if (!vis || ran.current) return; ran.current = true; const t0 = performance.now(); const go = n => { const p = Math.min((n - t0) / 1200, 1); setVal(Math.floor((1 - Math.pow(1 - p, 3)) * target)); if (p < 1) requestAnimationFrame(go); }; requestAnimationFrame(go); }, [vis, target]);
  return <span ref={ref}>{val}</span>;
}
function FadeIn({ children, delay = 0 }) {
  const [ref, v] = useInView(0.1);
  return <div ref={ref} style={{ opacity: v ? 1 : 0, transform: v ? "translateY(0)" : "translateY(20px)", transition: `all 0.6s cubic-bezier(0.22,1,0.36,1) ${delay}ms` }}>{children}</div>;
}

// ─── 점수 링 ───
function ScoreRing({ label, score, color, icon, delay = 0 }) {
  const [ref, v] = useInView(0.3);
  const r = 32, c = 2 * Math.PI * r;
  return (
    <div ref={ref} className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: 72, height: 72 }}>
        <svg viewBox="0 0 80 80" className="w-full h-full" style={{ transform: "rotate(-90deg)" }}>
          <circle cx="40" cy="40" r={r} fill="none" stroke="#f0ebe3" strokeWidth="4.5" />
          <circle cx="40" cy="40" r={r} fill="none" stroke={color} strokeWidth="4.5" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={v ? c * (1 - score / 100) : c} style={{ transition: `stroke-dashoffset 1.4s cubic-bezier(0.4,0,0.2,1) ${delay}ms` }} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span style={{ fontSize: 14 }}>{icon}</span>
          <span className="font-bold" style={{ color, fontSize: 12 }}>{v ? <AnimNum target={score} /> : 0}</span>
        </div>
      </div>
      <span style={{ color: "#8b7e6f", fontSize: 11 }}>{label}</span>
    </div>
  );
}

// ─── 만세력 카드 ───
function PillarCard({ p, index, total }) {
  if (p.empty) {
    return (
      <div className="relative flex flex-col items-center rounded-2xl overflow-hidden" style={{ animation: `cardReveal 0.8s ease ${index * 180}ms both`, border: "2px dashed #d4ccc0", background: "#faf7f2" }}>
        <div className="w-full pt-6 pb-2 px-2 text-center">
          <div style={{ fontSize: 11, color: "#a0937f", fontWeight: 600 }}>{p.label} <span style={{ color: "#c9b99a" }}>{p.sub}</span></div>
          <div style={{ fontSize: 10, color: "#c9b99a", marginBottom: 8 }}>{p.desc}</div>
          <div style={{ fontSize: 28, color: "#d4ccc0", fontWeight: 900 }}>?</div>
          <div style={{ fontSize: 10, color: "#c9b99a", marginTop: 4 }}>미입력</div>
        </div>
        <div className="w-full h-px" style={{ background: "#e8e0d4" }} />
        <div className="w-full py-2 px-2 text-center">
          <div style={{ fontSize: 28, color: "#d4ccc0", fontWeight: 900 }}>?</div>
          <div style={{ fontSize: 10, color: "#c9b99a", marginTop: 4 }}>미입력</div>
        </div>
        <div className="absolute inset-0 flex items-center justify-center" style={{ background: "rgba(250,247,242,0.6)" }}>
          <div className="text-center px-2">
            <div style={{ fontSize: 18 }}>🕐</div>
            <div style={{ fontSize: 9, color: "#a0937f", marginTop: 4, lineHeight: 1.4, fontWeight: 600 }}>출생시간<br/>미입력</div>
          </div>
        </div>
      </div>
    );
  }
  const gc = EC[p.gE], jc = EC[p.jE];
  return (
    <div className="relative flex flex-col items-center rounded-2xl overflow-hidden shadow-md" style={{ animation: `cardReveal 0.8s ease ${index * 180}ms both`, border: p.isMe ? `2.5px solid ${gc.main}` : "1px solid #e8e0d4" }}>
      {p.isMe && <div className="absolute top-0 left-0 right-0 text-center py-0.5 text-white z-10" style={{ background: gc.main, fontSize: 10, fontWeight: 800 }}>★ 나</div>}
      <div className="w-full pt-6 pb-2 px-2 text-center" style={{ background: gc.grad }}>
        <div style={{ fontSize: 11, color: gc.dark, fontWeight: 600 }}>{p.label} <span style={{ color: gc.main + "88" }}>{p.sub}</span></div>
        <div style={{ fontSize: 10, color: gc.main + "77", marginBottom: 6 }}>{p.desc}</div>
        <div style={{ fontSize: total === 4 ? 32 : 40, color: gc.dark, fontWeight: 900, lineHeight: 1 }}>{p.gH}</div>
        <div style={{ fontSize: 12, color: gc.main, fontWeight: 700, marginTop: 3 }}>{p.gKr} · {p.gM}</div>
        <div className="inline-block rounded-full mt-1" style={{ padding: "2px 8px", background: gc.main + "15", color: gc.dark, fontSize: 10, fontWeight: 600 }}>{p.gSip}</div>
      </div>
      <div className="w-8 h-px mx-auto" style={{ background: "linear-gradient(90deg,transparent,#c9b99a,transparent)" }} />
      <div className="w-full py-2 px-2 text-center" style={{ background: jc.grad }}>
        <div style={{ fontSize: total === 4 ? 32 : 40, color: jc.dark, fontWeight: 900, lineHeight: 1 }}>{p.jH}</div>
        <div style={{ fontSize: 12, color: jc.main, fontWeight: 700, marginTop: 3 }}>{p.jKr} · {p.jM}</div>
        <div className="inline-block rounded-full mt-1" style={{ padding: "2px 8px", background: jc.main + "15", color: jc.dark, fontSize: 10, fontWeight: 600 }}>{p.jSip}</div>
      </div>
    </div>
  );
}

// ─── 인라인 비주얼 ───
function OhengFlow() {
  return (
    <div className="my-4 p-4 rounded-2xl" style={{ background: "#faf7f2", border: "1px solid #e8e0d4" }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: "#6b5b47", marginBottom: 10 }}>▎오행 상생상극 — 이 사주의 핵심 구조</div>
      <div className="flex items-center justify-center gap-1 flex-wrap" style={{ fontSize: 11, color: "#8b7e6f", marginBottom: 8 }}>
        <span className="px-2 py-1 rounded-lg font-bold" style={{ background: EC.wood.light, color: EC.wood.dark }}>🌳 목 {HAS_TIME ? 88 : 85}</span>
        <span className="font-bold" style={{ color: "#c62828" }}>→극→</span>
        <span className="px-2 py-1 rounded-lg font-bold" style={{ background: EC.earth.light, color: EC.earth.dark }}>⛰️ 토(나) {HAS_TIME ? 50 : 55}</span>
        <span>→생→</span>
        <span className="px-2 py-1 rounded-lg font-bold" style={{ background: EC.metal.light, color: EC.metal.dark }}>⚔️ 금 {HAS_TIME ? 18 : 20}</span>
      </div>
      <div className="text-center px-2" style={{ fontSize: 11, color: "#a0937f", marginBottom: 10 }}>강한 목이 토(나)를 압박하고, 토가 낳은 금(식신)은 약한 구조</div>
      <div className="p-3 rounded-xl text-center" style={{ background: "#ffebee", border: "1px dashed #ef9a9a", fontSize: 11 }}>
        <div className="font-bold" style={{ color: "#c62828", marginBottom: 4 }}>🔥 2026년 해결책: 화(火) 에너지 유입!</div>
        <div className="flex items-center justify-center gap-1 flex-wrap" style={{ color: "#8b7e6f" }}>
          <span className="px-2 py-1 rounded-lg font-bold" style={{ background: EC.wood.light, color: EC.wood.dark }}>목</span>
          <span>→생→</span>
          <span className="px-2 py-1 rounded-lg font-bold" style={{ background: EC.fire.light, color: EC.fire.dark, border: "2px solid " + EC.fire.main }}>🔥 화</span>
          <span>→생→</span>
          <span className="px-2 py-1 rounded-lg font-bold" style={{ background: EC.earth.light, color: EC.earth.dark }}>토(나) ↑</span>
        </div>
        <div style={{ color: "#e65100", marginTop: 4 }}>목→화→토 순환 완성 = 압박이 풀림!</div>
        {HAS_TIME && <div style={{ color: "#8b7e6f", marginTop: 4, fontSize: 10 }}>시주 납음이 노중화(炉中火)! 내면에 숨겨진 화의 씨앗이 있었어요.</div>}
      </div>
    </div>
  );
}

function JijangganVis() {
  return (
    <div className="my-4 p-4 rounded-2xl" style={{ background: "#faf7f2", border: "1px solid #e8e0d4" }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: "#6b5b47", marginBottom: 10 }}>▎지장간 — 겉과 속이 다른 내면의 목소리들</div>
      <div className="grid gap-2" style={{ gridTemplateColumns: HAS_TIME ? "1fr 1fr 1fr" : "1fr 1fr" }}>
        <div className="p-3 rounded-xl text-center" style={{ background: EC.wood.light, border: `1px solid ${EC.wood.med}` }}>
          <div style={{ fontSize: 20, fontWeight: 900, color: EC.wood.dark }}>寅</div>
          <div style={{ fontSize: 10, color: EC.wood.main, fontWeight: 600 }}>인(목) · 년지+월지</div>
          <div className="mt-2 space-y-1">
            <div className="rounded-lg" style={{ background: "#fff", padding: "4px 6px", fontSize: 10, color: EC.wood.dark }}>甲 갑 · <b>정관</b><br/><span style={{ color: "#8b7e6f" }}>"제대로 해야 해"</span></div>
            <div className="rounded-lg" style={{ background: "#fff", padding: "4px 6px", fontSize: 10, color: EC.fire.dark }}>丙 병 · <b>정인</b><br/><span style={{ color: "#8b7e6f" }}>"더 배우고 싶어"</span></div>
            <div className="rounded-lg" style={{ background: "#fff", padding: "4px 6px", fontSize: 10, color: EC.earth.dark }}>戊 무 · <b>겁재</b><br/><span style={{ color: "#8b7e6f" }}>"밀리면 안 돼"</span></div>
          </div>
        </div>
        <div className="p-3 rounded-xl text-center" style={{ background: EC.metal.light, border: `1px solid ${EC.metal.med}` }}>
          <div style={{ fontSize: 20, fontWeight: 900, color: EC.metal.dark }}>酉</div>
          <div style={{ fontSize: 10, color: EC.metal.main, fontWeight: 600 }}>유(금) · 일지</div>
          <div className="mt-2">
            <div className="rounded-lg" style={{ background: "#fff", padding: "4px 6px", fontSize: 10, color: EC.metal.dark }}>辛 신 · <b>식신</b><br/><span style={{ color: "#8b7e6f" }}>"만들고 표현하자"</span></div>
          </div>
          <div className="rounded-lg mt-2" style={{ background: "#e8f5e9", padding: "3px 6px", fontSize: 10, color: "#2e7d32", fontWeight: 700 }}>장생(長生) 에너지!</div>
        </div>
        {HAS_TIME && (
          <div className="p-3 rounded-xl text-center" style={{ background: EC.wood.light, border: `1px solid ${EC.wood.med}` }}>
            <div style={{ fontSize: 20, fontWeight: 900, color: EC.wood.dark }}>卯</div>
            <div style={{ fontSize: 10, color: EC.wood.main, fontWeight: 600 }}>묘(목) · 시지</div>
            <div className="mt-2">
              <div className="rounded-lg" style={{ background: "#fff", padding: "4px 6px", fontSize: 10, color: EC.wood.dark }}>乙 을 · <b>칠살</b><br/><span style={{ color: "#8b7e6f" }}>"대충은 안 돼"</span></div>
            </div>
            <div className="rounded-lg mt-2" style={{ background: "#fff3e0", padding: "3px 6px", fontSize: 10, color: "#e65100", fontWeight: 700 }}>강한 추진력+압박</div>
          </div>
        )}
      </div>
    </div>
  );
}

function CareerFitVis() {
  const fits = [
    { label: "개발·기술", score: 92, color: EC.metal.main },
    { label: "디자인·창작", score: 88, color: EC.fire.main },
    { label: "기획·전략", score: 80, color: EC.earth.main },
    { label: "영업·대인", score: 45, color: EC.wood.main },
    { label: "순수 관리직", score: 40, color: EC.water.main },
  ];
  return (
    <div className="my-4 p-4 rounded-2xl" style={{ background: "#faf7f2", border: "1px solid #e8e0d4" }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: "#6b5b47", marginBottom: 10 }}>▎직업 적성 매칭도</div>
      <div className="space-y-2">
        {fits.map((f, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="text-right" style={{ width: 72, fontSize: 11, fontWeight: 600, color: "#6b5b47" }}>{f.label}</span>
            <div className="flex-1 rounded-full overflow-hidden" style={{ height: 18, background: "#efe8db" }}>
              <div className="h-full rounded-full flex items-center justify-end pr-2" style={{ width: `${f.score}%`, background: f.color + "cc" }}>
                <span style={{ fontSize: 10, fontWeight: 800, color: "#fff" }}>{f.score}%</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function HealthVis() {
  const items = [
    { elem: "wood", organ: "간·눈·근육", status: "과다 ⚠️", advice: "눈 휴식, 음주 절제", c: "#c62828" },
    { elem: "fire", organ: "심장·혈압", status: "2026 주의", advice: "시원한 음식, 과로 금지", c: "#e65100" },
    { elem: "earth", organ: "위·소화기", status: "보통", advice: "규칙적 식사", c: "#2e7d32" },
    { elem: "metal", organ: "폐·피부", status: "약함", advice: "호흡 운동, 환절기 주의", c: "#e65100" },
    { elem: "water", organ: "신장·방광", status: "없음 🚨", advice: "수분 섭취 필수!", c: "#c62828" },
  ];
  return (
    <div className="my-4 p-4 rounded-2xl" style={{ background: "#faf7f2", border: "1px solid #e8e0d4" }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: "#6b5b47", marginBottom: 10 }}>▎오행별 건강 체크</div>
      <div className="space-y-1.5">
        {items.map((it, i) => (
          <div key={i} className="flex items-center gap-2 p-2 rounded-lg" style={{ background: "#fff", fontSize: 11 }}>
            <span>{EEMO[it.elem]}</span>
            <span style={{ width: 60, fontWeight: 600, color: "#6b5b47" }}>{it.organ}</span>
            <span style={{ width: 64, fontWeight: 800, color: it.c }}>{it.status}</span>
            <span className="flex-1" style={{ color: "#8b7e6f" }}>{it.advice}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function GaewoonVis() {
  const items = [
    { icon: "🎨", label: "색상", desc: "검정·남색(수) + 흰색·은색(금)" },
    { icon: "🧭", label: "방위", desc: "북(수)·서(금) 방향으로 책상 배치" },
    { icon: "🍽️", label: "음식", desc: "해산물·검은깨(수) + 배·닭고기(금)" },
    { icon: "🏊", label: "운동", desc: "수영 최고! 요가·등산도 추천" },
  ];
  return (
    <div className="my-4 p-4 rounded-2xl" style={{ background: "#faf7f2", border: "1px solid #e8e0d4" }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: "#6b5b47", marginBottom: 10 }}>▎개운법 한눈에</div>
      <div className="grid grid-cols-2 gap-2">
        {items.map((it, i) => (
          <div key={i} className="p-3 rounded-xl text-center" style={{ background: "#fff", border: "1px solid #e8e0d4" }}>
            <div style={{ fontSize: 22, marginBottom: 4 }}>{it.icon}</div>
            <div style={{ fontSize: 11, fontWeight: 800, color: "#6b5b47", marginBottom: 2 }}>{it.label}</div>
            <div style={{ fontSize: 10, color: "#8b7e6f" }}>{it.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SectionVis({ type }) {
  if (type === "oheng_structure") return <OhengFlow />;
  if (type === "jijanggan") return <JijangganVis />;
  if (type === "career_fit") return <CareerFitVis />;
  if (type === "health_oheng") return <HealthVis />;
  if (type === "gaewoon") return <GaewoonVis />;
  return null;
}

// ─── 상세 풀이 데이터 ───
const SECTIONS = [
  { id: "summary", icon: "☯️", title: "사주 총평", visual: "oheng_structure",
    content: `일간이 己土(기토)입니다. 기토는 논밭의 부드러운 흙이에요. 딱딱한 바위(戊토)와 달리, 생명을 품고 키워내는 포용적인 흙입니다. 겉으로는 온화하고 수용적이지만, 그 안에 놀라운 생산력을 가지고 있어요.

이 사주의 가장 극적인 구조는 목(木)의 압도적 우세입니다. 년지·월지 모두 寅(인목)${HAS_TIME ? ", 시지에 卯(묘목)까지" : "이고"} — 부드러운 논밭에 거대한 나무${HAS_TIME ? " 세 그루가" : " 두 그루가"} 뿌리를 내린 형국입니다. 명리학에서 '목극토(木剋土)'라 하여 나무가 흙의 양분을 빼앗고 뿌리로 흙을 헤집는 관계인데, 삶에서는 "외부의 기대·압력·책임감이 끊임없이 나를 압박하는 구조"로 나타납니다.

결정적인 반전이 있습니다. 일지(나의 본질 자리)에 酉(유금)가 있고, 12운성이 장생(長生)이에요. 년·월에서는 에너지가 수렴되는 '사(死)' 상태인데, 정작 본질에서는 장생 — 겉으로는 조용하지만 속에는 끊임없이 새로운 것을 만들어내고 싶은 강렬한 생명력이 숨어있습니다.
${HAS_TIME ? `
시주에서 특히 주목할 점이 있어요. 시간 丁(정화)은 편인 — 직관·영감·특수기술의 에너지가 '결과물' 자리에 있다는 뜻이에요. 나이 들수록 독창적인 아이디어와 창작 능력이 더 강해집니다. 납음이 노중화(炉中火/화로 안의 불)인 것도 의미심장해요. 사주 원국에는 화가 겉으로 안 보이는데, 시주 깊은 곳에 뜨거운 불꽃이 숨어있었던 겁니다.` : ""}

수(水)가 사주에 완전히 없다는 것도 큰 특징입니다. 수는 지혜, 유연성, 흐름을 상징하는데, 이게 없으면 한번 마음먹은 걸 꺾기 어렵고 감정의 유연한 전환이 잘 안 됩니다. 대신 현재 대운(丁巳)에서 화가 강하게 들어와 일간 己토를 도와주는 구조가 형성되어 있어요.` },
  { id: "personality", icon: "🧬", title: "타고난 성격과 기질", visual: "jijanggan",
    content: `겉으로 보이는 모습부터 봅시다. 12운성이 년지·월지 모두 '사(死)'예요. 에너지가 밖으로 발산되기보다 안으로 응축되는 상태입니다. "생각이 많은 사람", "좀 과묵하다"는 인상을 줍니다. 말수가 적은 건 할 말이 없어서가 아니라, 머릿속에서 이미 여러 번 정리하고 나서 말하는 타입이기 때문이에요.

지장간(地藏干)을 보면 속마음은 훨씬 치열합니다. 寅(인목) 안에 甲(정관: "제대로 해야 한다"), 丙(정인: "더 배우고 싶다"), 戊(겁재: "밀리면 안 된다") 세 목소리가 동시에 돌아가고 있어요. 이게 년지와 월지에 똑같이 반복됩니다.
${HAS_TIME ? `
시지 卯(묘목)의 지장간 乙(을목)은 칠살입니다. 칠살은 강한 압박이지만 동시에 추진력과 돌파력을 주는 별이에요. 결과물을 만들 때 "대충"이 안 되는 구조 — 무엇을 만들든 완성도에 집착하는 경향이 있습니다.` : ""}

일지 식신(酉/辛)이 장생이라 혼자만의 시간에 뭔가를 만들어내는 데 가장 큰 만족감을 느껴요. "내 손으로 무에서 유를 만드는 과정"에서 살아있음을 느끼는 사람입니다. 식신은 식복(食福)의 별이기도 해서 먹는 것에 관심이 높고 맛집 탐방이나 직접 요리를 좋아할 가능성이 높아요.

신살 중 원무(元武)가 있어서 속마음을 쉽게 드러내지 않습니다. 단점이 아니라 특성이에요. 다만 가까운 사람에게까지 벽을 세우면 관계가 피상적이 될 수 있으니, 신뢰하는 사람에게는 의식적으로 열어보세요.` },
  { id: "social", icon: "🤝", title: "대인관계와 소통",
    content: `년간에 겁재(戊)가 있어요. 어릴 때부터 또래 사이에서 경쟁을 경험하며 자기 것을 지키는 법을 배운 사람입니다. 월간의 정관(甲)이 대인관계에서 가장 큰 영향을 미쳐요. 질서·예의·체면을 중시해서 선 넘는 행동을 극도로 싫어합니다.
${HAS_TIME ? `
시주의 칠살(卯/乙)은 대인관계에서 흥미로운 양면성을 줍니다. 겉으로는 조용하지만, 무시당하거나 부당한 대우를 받으면 예상 외로 강하게 반응해요. 칠살 에너지가 결과물 자리에 있으니, 특히 "자기가 만든 것"에 대한 비판에 민감할 수 있습니다. 건설적 피드백과 무례한 비난을 구분하는 연습이 도움이 됩니다.` : ""}

신살 중 오리(五离)가 있어서 모든 사람과 넓게 사귀기보다 소수의 신뢰할 수 있는 사람과 깊은 관계를 유지하는 타입이에요. 앞에 나서는 리더십보다 묵묵히 자기 일로 인정받는 스타일.

명폐(鸣吠) 길신으로 말과 글을 통한 영향력이 있어요. 대면보다 콘텐츠, 글, 제품을 통해 소통할 때 더 힘이 실립니다.` },
  { id: "career", icon: "💼", title: "직업운과 적성", visual: "career_fit",
    content: `월간 정관이 투출해 있으니 직장생활과 인연이 깊어요. 완전한 프리랜서보다 소속+자율성 조합이 최적. IT 기업 개발자, 크리에이티브 에이전시, 안정적 수입원 있는 1인 사업이 맞습니다.

일지 식신(酉/辛)이 장생이니 무에서 유를 만드는 직업이 핵심 적성이에요. 개발, 디자인, 콘텐츠 제작, 기획 — 한 방이 아니라 꾸준한 결과물 축적형.
${HAS_TIME ? `
시주 편인(丁)이 결과물 자리에 있어서, 나이 들수록 전문성과 독창성이 강해집니다. 특히 남들이 안 하는 독특한 분야에서 자기만의 포지션을 만들 때 빛나요. 칠살(卯)의 추진력이 있어서 일단 방향이 정해지면 끝까지 밀고 나가는 힘도 있습니다.` : ""}

지장간에 정인(丙)이 2개 숨어있어서 학습 능력이 뛰어나요. "하고 싶어서" 배울 때 진짜 실력이 붙는 구조.

현재 대운(丁巳)은 정인 에너지가 강해서 사업보다 실력과 전문성을 쌓는 데 집중하는 게 유리합니다. 32세 이후 대운(戊午)부터 자기 사업이 궤도에 오를 수 있어요.` },
  { id: "wealth", icon: "💰", title: "재물운",
    content: `재성이 천간에 없어서 돈 자체가 최우선 동기는 아닙니다. 의미 있는 일을 먼저 선택하는 경향. 하지만 식신생재(食神生財)의 경로가 열려있어요 — "내가 만든 것의 가치를 인정받아서 버는 방식"이 가장 자연스럽습니다.
${HAS_TIME ? `
시주에 편인(丁)이 있는데, 편인이 식신을 극하는 '도식(倒食)' 관계가 될 수 있어요. 이건 "아이디어는 넘치는데 수익화로 연결하는 데 한 단계 더 노력이 필요하다"는 의미입니다. 만든 것을 세상에 내놓는 과정(마케팅, 영업, 가격 설정)을 의식적으로 배울 필요가 있어요.` : ""}

겁재(戊)가 년간에 있어서 친구나 지인 부탁에 쉽게 돈을 쓰는 경향. 보증이나 동업 시 금전 문제 특히 주의.

수(水) 부재로 재무관리 감각을 의식적으로 키워야 해요. 돈의 흐름을 시각화하는 습관 자체가 개운법. 재테크는 장기 투자형(부동산, 인덱스 펀드, 자기 사업 가치 성장)이 맞습니다.` },
  { id: "love", icon: "💕", title: "애정운과 연애 스타일",
    content: `일지(배우자 자리) 酉(유금/식신) — 배우자에게 뭔가 해주고 싶은 마음이 강해요. 요리, 선물, 상대가 필요한 걸 미리 챙기는 타입. 정관이 강해서 가볍게 만나는 걸 못 하고, 한번 사귀면 진지하게 갑니다.
${HAS_TIME ? `
시주(자녀·결과물 자리)에 칠살(卯/乙)이 있어요. 연애에서 이건 "상대방에게 자기도 모르게 높은 기준을 적용하는" 경향으로 나타납니다. 완벽한 관계를 추구하다 보면 작은 실망에도 크게 흔들릴 수 있어요. "완벽한 사람은 없다"는 걸 머리가 아니라 마음으로 받아들이는 게 연애의 과제입니다.` : ""}

이상형: 지적이고 깊이 있으면서도 함께 있으면 편한 사람. 외모보다 대화가 통하는 사람에게 마음이 갑니다.

결혼운: 다음 대운(戊午, 32~41세) 시기에 더 강해질 수 있어요. 지금은 자기를 키우는 시기.` },
  { id: "health", icon: "🏥", title: "건강 주의사항", visual: "health_oheng",
    content: `목(木) 과다 → 간·담낭·눈·근육·신경. 장시간 모니터 작업 시 눈 건강과 간 관리 특히 주의. 20-20-20 규칙(20분마다 20초간 6m 먼 곳)을 습관화하세요.

수(水) 완전 부재 → 신장·방광·귀·생식기. 하루 2L 이상 수분 섭취가 매우 중요. 30대부터 신장 정기 검진 추천.

금(金) 약함 → 폐·대장·피부·호흡기. 환절기 감기, 알레르기 비염 주의. 깊은 호흡 운동이 금 에너지를 보충해요.
${HAS_TIME ? `
시주 12운성이 病(병) — 말년 건강에 특히 주의가 필요합니다. 젊을 때부터 건강 습관을 꾸준히 잡아놓는 게 중요해요. 특히 수(水) 보충을 지금부터 생활화하세요.` : ""}

2026년 화 과잉 시기 → 심장·혈압·열 관련 주의. 시원한 음식(오이, 수박, 녹차)으로 밸런스. 최적 운동: 수영(수+금 동시 보충).` },
  { id: "year2026", icon: "🔥", title: "2026년 운세",
    content: `올해는 이 사주에게 매우 중요한 해입니다.

대운 丁巳(정사) + 세운 丙午(병오) = 화(火) 에너지가 사상 최대로 들어옵니다. 원래 사주에는 화가 지장간에만 숨어있었는데, 대운과 세운 양쪽에서 화가 폭발적으로 밀려들어요.
${HAS_TIME ? "시주 납음이 노중화(炉中火)인 것과 맞물려서, 내면의 불꽃이 외부의 화 에너지와 공명하는 해입니다." : ""}

화생토(火生土) — 일간 己토를 강하게 지원하는 해. 목의 극을 받던 기토가 화의 지원으로 한층 강해집니다.

기회: 직관과 영감 폭발. 새 기술을 배우면 놀라운 속도로 흡수. 콘텐츠 제작, 사업 시작, 작품 발표에 최적. 중요한 인연이 들어올 가능성 높음.

주의: 급한 결정 실수 주의(하루 재워놓기). 이것저것 손대지 말고 하나에 집중. 수분 섭취, 과로 금지, 수면 관리.` },
  { id: "mission", icon: "🌟", title: "인생의 핵심 과제와 숨겨진 재능",
    content: `핵심 과제: "남의 기대(정관/목)"와 "내가 하고 싶은 것(식신/금)" 사이의 균형.
${HAS_TIME ? `
시주 편인(丁)이 결과물 자리에 있어서, 이 균형을 찾아가는 과정 자체가 독창적인 결과물이 됩니다. "남들이 안 하는 방식으로 자기만의 길을 만드는 사람" — 이게 이 사주의 최종 형태예요.` : ""}

공망 분석: 일공 寅卯(목) — "남의 요구에 매이지 말라". 년공 申酉(금) — "사회적 인정은 늦게 오지만 한꺼번에 돌아옴".

숨겨진 재능: 천은+음덕(위기 때 도움이 오는 체질), 명폐(말과 글의 별), 복생(진심으로 몰입할 때 복이 따름).

핵심: 남의 요구에 응하되, 반드시 자기만의 창작 시간을 확보하세요. 일지 장생이 보여주듯, 진짜 에너지원은 자기가 만들어내는 것에 있습니다.` },
  { id: "luck", icon: "🍀", title: "개운법", visual: "gaewoon",
    content: `오행 보완 — 수(水)·금(金) 보충이 핵심:
• 색상: 검정·남색(수) + 흰색·은색(금)
• 방위: 북(수)·서(금) 방향으로 책상/사무실 배치
• 음식: 해산물·콩·검은깨·미역(수) + 배·무·닭고기(금)
• 운동: 수영 최고! 요가·태극권도 좋음

행동 습관:
• 매일 아침 5분 깊은 호흡 → 금 에너지 활성화, 목의 압박 완화
• 주 1회 "내가 하고 싶은 것만 하는 날" → 식신 에너지 충전
• 감정 저널링 하루 3줄 → 수 에너지 보충
• 물 의식적으로 마시기 → 가장 쉬운 개운법

2026년 특별:
• 화 과잉 → 시원한 환경, 차분한 활동으로 밸런스
• 하나에 집중 → 편인의 산만함을 식신의 꾸준함으로 잡기
• 올해 인연 소중히 → 화의 해에 만난 사람은 중요한 관계가 될 가능성
• 남몰래 작은 선행 → 천은·음덕 활성화` },
];

function ReportSection({ section, index }) {
  const [expanded, setExpanded] = useState(index < 2);
  return (
    <FadeIn delay={index * 50}>
      <div className="rounded-2xl overflow-hidden" style={{ background: "#fff", border: "1px solid #e8e0d4", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
        <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center gap-3 p-4 text-left" style={{ background: expanded ? "#faf7f2" : "#fff" }}>
          <span style={{ fontSize: 18 }}>{section.icon}</span>
          <span className="flex-1 font-bold" style={{ color: "#3d3427", fontSize: 13 }}>{section.title}</span>
          <span style={{ color: "#c9b99a", fontSize: 13, display: "inline-block", transition: "transform 0.3s", transform: expanded ? "rotate(180deg)" : "rotate(0)" }}>▾</span>
        </button>
        {expanded && (
          <div className="px-4 pb-4">
            <div className="whitespace-pre-line" style={{ fontSize: 13, lineHeight: 1.85, color: "#5a4e3d" }}>{section.content}</div>
            {section.visual && <SectionVis type={section.visual} />}
          </div>
        )}
      </div>
    </FadeIn>
  );
}

// ─── 메인 ───
export default function App() {
  const radarData = Object.entries(SAJU.elements).map(([k, v]) => ({ subject: EKR[k].replace(/\(.*\)/, ""), value: v, fullMark: 100 }));
  const pillarCount = SAJU.pillars.length;

  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(180deg,#f5f0e8 0%,#faf7f2 15%,#f5f0e8 100%)", fontFamily: "'Pretendard',-apple-system,'Noto Sans KR',sans-serif" }}>
      <style>{`
        @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css');
        @keyframes cardReveal { from { opacity:0; transform:translateY(24px) scale(0.96); } to { opacity:1; transform:translateY(0) scale(1); } }
        * { box-sizing:border-box; margin:0; padding:0; }
        ::-webkit-scrollbar { display:none; }
      `}</style>

      {/* 헤더 */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 50% 20%,rgba(201,185,154,0.22) 0%,transparent 60%)" }} />
        <div className="relative text-center" style={{ padding: "48px 20px 20px" }}>
          <div className="inline-flex items-center gap-2 rounded-full" style={{ padding: "5px 14px", background: "rgba(201,185,154,0.18)", color: "#8b7e6f", border: "1px solid rgba(201,185,154,0.25)", fontSize: 11, fontWeight: 600, marginBottom: 12 }}>☯️ 사주명리 분석 리포트</div>
          <h1 style={{ fontSize: 26, fontWeight: 900, color: "#3d3427", marginBottom: 4 }}>{SAJU.name}님의 사주</h1>
          <div className="flex flex-wrap justify-center gap-1.5" style={{ fontSize: 11, color: "#a0937f" }}>
            <span>{SAJU.birth}</span><span>·</span><span>{SAJU.lunarBirth}</span><span>·</span><span>{SAJU.gender}</span><span>·</span><span>{SAJU.zodiac}</span>
            {SAJU.birthTime && <><span>·</span><span>{SAJU.birthTime}</span></>}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 520, margin: "0 auto", padding: "0 16px 80px" }}>
        <div className="space-y-5">

          {/* 시간 미입력 안내 */}
          {!HAS_TIME && (
            <FadeIn>
              <div className="rounded-2xl p-4" style={{ background: "#fff3e0", border: "1px solid #ffe0b2" }}>
                <div className="flex items-start gap-3">
                  <span style={{ fontSize: 20 }}>🕐</span>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: "#e65100", marginBottom: 2 }}>출생시간이 입력되지 않았습니다</div>
                    <div style={{ fontSize: 11, color: "#f57c00", lineHeight: 1.6 }}>
                      현재 3기둥 6글자로 분석 중이에요. 출생시간을 입력하면 <b>시주(時柱)</b>가 추가되어 자녀운, 말년운, 더 정밀한 성격·직업 분석이 가능합니다.
                    </div>
                  </div>
                </div>
              </div>
            </FadeIn>
          )}

          {/* 사주팔자 구조 해설 */}
          <FadeIn>
            <div className="rounded-2xl p-4" style={{ background: "#fff", border: "1px solid #e8e0d4", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
              <h2 style={{ fontSize: 13, fontWeight: 800, color: "#3d3427", marginBottom: 4 }}>📖 사주팔자(四柱八字)란?</h2>
              <p style={{ fontSize: 11, color: "#8b7e6f", lineHeight: 1.7, marginBottom: 12 }}>
                태어난 <b style={{ color: "#6b5b47" }}>해·월·일·시</b>의 네 기둥(四柱), 각 기둥의 천간(위)·지지(아래) 여덟 글자(八字).
                {HAS_TIME ? " 4기둥 8글자 완전판으로 분석합니다." : " 출생시간 미상으로 3기둥 6글자로 분석합니다."}
              </p>
              <div className="grid grid-cols-2 gap-2 text-center" style={{ fontSize: 11, color: "#8b7e6f", marginBottom: 12 }}>
                <div className="p-2 rounded-xl" style={{ background: "#faf7f2" }}>
                  <div style={{ fontWeight: 800, color: "#6b5b47", marginBottom: 2 }}>↑ 천간 天干</div>
                  <div>하늘의 기운 · 겉으로 드러나는 나</div>
                </div>
                <div className="p-2 rounded-xl" style={{ background: "#faf7f2" }}>
                  <div style={{ fontWeight: 800, color: "#6b5b47", marginBottom: 2 }}>↓ 지지 地支</div>
                  <div>땅의 기운 · 내면에 숨겨진 나</div>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-1.5 text-center" style={{ fontSize: 10, color: "#a0937f" }}>
                {[
                  { t: "년주 年柱", d: "조상·사회" },
                  { t: "월주 月柱", d: "부모·직장" },
                  { t: "일주 日柱", d: "나·배우자", hl: true },
                  { t: "시주 時柱", d: "자녀·말년", dim: !HAS_TIME },
                ].map((x, i) => (
                  <div key={i} className="p-2 rounded-lg" style={{
                    background: x.hl ? EC.earth.light : x.dim ? "#faf7f2" : "#faf7f2",
                    border: x.hl ? `1.5px solid ${EC.earth.med}` : x.dim ? "1px dashed #d4ccc0" : "none",
                    opacity: x.dim ? 0.6 : 1,
                  }}>
                    <div style={{ fontWeight: 800, color: x.hl ? EC.earth.dark : "#6b5b47", fontSize: 10 }}>{x.t}{x.hl ? " ★" : ""}</div>
                    <div style={{ color: x.hl ? EC.earth.main : "#a0937f" }}>{x.d}</div>
                  </div>
                ))}
              </div>
            </div>
          </FadeIn>

          {/* 만세력 원국 */}
          <FadeIn delay={80}>
            <div className="rounded-2xl p-4" style={{ background: "linear-gradient(135deg,#fff 0%,#faf7f2 100%)", border: "1px solid #d4c5a9", boxShadow: "0 4px 16px rgba(201,185,154,0.12)" }}>
              <div className="flex items-center gap-2" style={{ marginBottom: 12 }}>
                <h2 style={{ fontSize: 13, fontWeight: 800, color: "#3d3427" }}>🏛️ 만세력 원국</h2>
                <span className="rounded-full" style={{ padding: "2px 10px", background: "linear-gradient(135deg,#c9b99a,#a08b6a)", color: "#fff", fontSize: 10, fontWeight: 700 }}>
                  {HAS_TIME ? "4기둥 8글자" : "3기둥 6글자"}
                </span>
              </div>
              <div className="grid gap-2.5" style={{ gridTemplateColumns: `repeat(${pillarCount}, 1fr)` }}>
                {SAJU.pillars.map((p, i) => <PillarCard key={i} p={p} index={i} total={pillarCount} />)}
              </div>
              <div className="text-center" style={{ marginTop: 10, fontSize: 11, color: "#a0937f" }}>
                일간 <span style={{ fontWeight: 900, fontSize: 14, color: EC.earth.dark }}>己(기토)</span> = 나 자신 · 논밭의 부드러운 흙
              </div>
            </div>
          </FadeIn>

          {/* 오행 밸런스 */}
          <FadeIn delay={80}>
            <div className="rounded-2xl p-4" style={{ background: "#fff", border: "1px solid #e8e0d4" }}>
              <h2 style={{ fontSize: 13, fontWeight: 800, color: "#3d3427", marginBottom: 8 }}>⚖️ 오행 밸런스</h2>
              <div style={{ height: 200 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData}><PolarGrid stroke="#e8e0d4" /><PolarAngleAxis dataKey="subject" tick={{ fill: "#6b5b47", fontSize: 11, fontWeight: 600 }} /><Radar dataKey="value" stroke="#c9b99a" fill="#c9b99a" fillOpacity={0.2} strokeWidth={2} dot={{ r: 3, fill: "#a08b6a", stroke: "#fff", strokeWidth: 2 }} /></RadarChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2 mt-2">
                {Object.entries(SAJU.elements).map(([elem, val]) => {
                  const ec = EC[elem];
                  return (
                    <div key={elem} className="flex items-center gap-2">
                      <span style={{ fontSize: 13 }}>{EEMO[elem]}</span>
                      <span className="text-right" style={{ width: 50, fontSize: 11, fontWeight: 700, color: ec.dark }}>{EKR[elem]}</span>
                      <div className="flex-1 rounded-full overflow-hidden" style={{ height: 16, background: ec.light }}>
                        <div className="h-full rounded-full" style={{ width: `${Math.max(val, 3)}%`, background: `linear-gradient(90deg,${ec.med},${ec.main})`, transition: "width 1s" }} />
                      </div>
                      <span className="text-right" style={{ width: 32, fontSize: 11, fontWeight: 800, color: val === 0 ? "#c62828" : ec.dark }}>{val === 0 ? "없음!" : val}</span>
                    </div>
                  );
                })}
              </div>
              <div className="rounded-xl mt-3 p-3" style={{ background: "#fff3e0", border: "1px solid #ffe0b2", fontSize: 11, color: "#e65100" }}>
                ⚠️ <b>수(水) 에너지 완전 부재.</b> 개운법에서 보충 방법을 꼭 확인하세요!
              </div>
            </div>
          </FadeIn>

          {/* 12운성 */}
          <FadeIn delay={80}>
            <div className="rounded-2xl p-4" style={{ background: "#fff", border: "1px solid #e8e0d4" }}>
              <h2 style={{ fontSize: 13, fontWeight: 800, color: "#3d3427", marginBottom: 10 }}>🔄 12운성 — 에너지 상태</h2>
              <div className="space-y-2">
                {SAJU.unyoung12.map((u, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-xl" style={{ background: u.value === "長生" ? "#e8f5e9" : u.value === "病" ? "#fce4ec" : "#fff3e0", border: u.value === "長生" ? "1px solid #a5d6a7" : u.value === "病" ? "1px solid #f8bbd0" : "1px solid #ffe0b2" }}>
                    <div className="text-center" style={{ minWidth: 44 }}>
                      <div style={{ fontSize: 18, fontWeight: 900, color: u.color }}>{u.value}</div>
                      <div style={{ fontSize: 10, color: u.color + "99" }}>{u.kr}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 800, color: "#6b5b47", marginBottom: 2 }}>{u.pillar}</div>
                      <div style={{ fontSize: 11, color: "#8b7e6f", lineHeight: 1.6 }}>{u.meaning}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </FadeIn>

          {/* 점수 */}
          <FadeIn delay={80}>
            <div className="rounded-2xl p-4" style={{ background: "#fff", border: "1px solid #e8e0d4" }}>
              <h2 style={{ fontSize: 13, fontWeight: 800, color: "#3d3427", marginBottom: 12 }}>📊 운세 종합 점수</h2>
              <div className="grid grid-cols-3 gap-2">
                <ScoreRing label="직업운" score={SAJU.scores.career} color="#2563eb" icon="💼" />
                <ScoreRing label="애정운" score={SAJU.scores.love} color="#db2777" icon="💕" delay={100} />
                <ScoreRing label="재물운" score={SAJU.scores.wealth} color="#d97706" icon="💰" delay={200} />
                <ScoreRing label="대인운" score={SAJU.scores.social} color="#7c3aed" icon="🤝" delay={300} />
                <ScoreRing label="건강운" score={SAJU.scores.health} color="#059669" icon="🏥" delay={400} />
                <ScoreRing label="잠재력" score={SAJU.scores.potential} color="#ea580c" icon="🌟" delay={500} />
              </div>
            </div>
          </FadeIn>

          {/* 대운 흐름 */}
          <FadeIn delay={80}>
            <div className="rounded-2xl p-4" style={{ background: "#fff", border: "1px solid #e8e0d4" }}>
              <h2 style={{ fontSize: 13, fontWeight: 800, color: "#3d3427", marginBottom: 12 }}>📅 대운 흐름</h2>
              <div className="space-y-2.5">
                {SAJU.daeun.map((d, i) => {
                  const ec = EC[d.elem];
                  return (
                    <div key={i} className="flex items-center gap-3 rounded-xl" style={{ padding: "10px 12px", background: d.current ? ec.light : "#faf7f2", border: d.current ? `2px solid ${ec.main}` : "1px solid #e8e0d4", boxShadow: d.current ? `0 2px 10px ${ec.main}18` : "none" }}>
                      <div className="text-center" style={{ minWidth: 50 }}>
                        <div style={{ fontSize: 18, fontWeight: 900, color: ec.dark }}>{d.gz}</div>
                        <div style={{ fontSize: 10, fontWeight: 600, color: ec.main }}>{d.kr}</div>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span style={{ fontSize: 11, fontWeight: 800, color: "#6b5b47" }}>{d.age}</span>
                          {d.current && <span className="rounded text-white" style={{ padding: "1px 6px", background: ec.main, fontSize: 9, fontWeight: 800 }}>현재</span>}
                        </div>
                        <div style={{ fontSize: 10, color: "#a0937f" }}>{d.period} · {d.label}</div>
                      </div>
                      <span style={{ fontSize: 16 }}>{EEMO[d.elem]}</span>
                    </div>
                  );
                })}
              </div>
              <div className="rounded-xl mt-3 p-3" style={{ background: "#ffebee", border: "1px solid #ffcdd2", fontSize: 11, color: "#c62828" }}>
                🔥 <b>현재 丁巳(정사) 대운 + 2026 丙午(병오) 세운 = 화(火) 폭발!</b>
              </div>
            </div>
          </FadeIn>

          {/* 납음 */}
          <FadeIn delay={80}>
            <div className="rounded-2xl p-4" style={{ background: "#fff", border: "1px solid #e8e0d4" }}>
              <h2 style={{ fontSize: 13, fontWeight: 800, color: "#3d3427", marginBottom: 10 }}>🎵 납음 — 근본 에너지</h2>
              <div className="space-y-2">
                {SAJU.napeum.map((n, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: "#faf7f2" }}>
                    <span style={{ fontSize: 20 }}>{n.icon}</span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span style={{ fontSize: 12, fontWeight: 800, color: "#6b5b47" }}>{n.hanja}</span>
                        <span style={{ fontSize: 10, color: "#a0937f" }}>{n.kr}</span>
                        <span className="rounded" style={{ padding: "1px 6px", background: "#e8e0d4", color: "#6b5b47", fontSize: 10 }}>{n.pillar}</span>
                      </div>
                      <div style={{ fontSize: 11, color: "#8b7e6f", marginTop: 2 }}>{n.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </FadeIn>

          {/* 신살 */}
          <FadeIn delay={80}>
            <div className="rounded-2xl p-4" style={{ background: "#fff", border: "1px solid #e8e0d4" }}>
              <h2 style={{ fontSize: 13, fontWeight: 800, color: "#3d3427", marginBottom: 10 }}>✦ 신살 — 타고난 별</h2>
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: "#2e7d32", marginBottom: 6 }}>길신</div>
                <div className="space-y-1.5">
                  {SAJU.gilsin.map((g, i) => (
                    <div key={i} className="flex items-start gap-2 p-2 rounded-lg" style={{ background: "#e8f5e9", fontSize: 11 }}>
                      <span style={{ fontWeight: 800, color: "#2e7d32", minWidth: 32 }}>{g.hanja}</span>
                      <span style={{ fontWeight: 600, color: "#2e7d32", minWidth: 24 }}>{g.kr}</span>
                      <span className="flex-1" style={{ color: "#4caf50" }}>{g.desc}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 800, color: "#e65100", marginBottom: 6 }}>흉살 (주의)</div>
                <div className="space-y-1.5">
                  {SAJU.hyungsal.map((h, i) => (
                    <div key={i} className="flex items-start gap-2 p-2 rounded-lg" style={{ background: "#fff3e0", fontSize: 11 }}>
                      <span style={{ fontWeight: 800, color: "#e65100", minWidth: 32 }}>{h.hanja}</span>
                      <span style={{ fontWeight: 600, color: "#e65100", minWidth: 24 }}>{h.kr}</span>
                      <span className="flex-1" style={{ color: "#f57c00" }}>{h.desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </FadeIn>

          {/* 공망 */}
          <FadeIn delay={80}>
            <div className="rounded-2xl p-4" style={{ background: "#fff", border: "1px solid #e8e0d4" }}>
              <h2 style={{ fontSize: 13, fontWeight: 800, color: "#3d3427", marginBottom: 10 }}>🔓 공망 — 비어있는 에너지</h2>
              <div className="space-y-2">
                {SAJU.gongmang.map((g, i) => (
                  <div key={i} className="p-3 rounded-xl" style={{ background: "#f3e5f5", border: "1px solid #e1bee7" }}>
                    <div className="flex items-center gap-2" style={{ marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 900, color: "#6a1b9a" }}>{g.value}</span>
                      <span style={{ fontSize: 11, fontWeight: 600, color: "#8e24aa" }}>{g.kr}</span>
                      <span className="rounded" style={{ padding: "1px 6px", background: "#e1bee7", color: "#6a1b9a", fontSize: 10 }}>{g.basis}</span>
                    </div>
                    <div style={{ fontSize: 11, color: "#7b1fa2" }}>{g.meaning}</div>
                  </div>
                ))}
              </div>
            </div>
          </FadeIn>

          {/* 상세 풀이 */}
          <div>
            <div className="flex items-center gap-2 px-1" style={{ marginBottom: 10 }}>
              <div style={{ width: 20, height: 1, background: "#c9b99a" }} />
              <h2 style={{ fontSize: 13, fontWeight: 800, color: "#3d3427" }}>📜 상세 풀이</h2>
              <div className="flex-1" style={{ height: 1, background: "#e8e0d4" }} />
            </div>
            <div className="space-y-2.5">
              {SECTIONS.map((s, i) => <ReportSection key={s.id} section={s} index={i} />)}
            </div>
          </div>

          {/* 푸터 */}
          <div className="text-center" style={{ paddingTop: 28, paddingBottom: 12 }}>
            <div className="mx-auto" style={{ width: 48, height: 1, marginBottom: 12, background: "linear-gradient(90deg,transparent,#c9b99a,transparent)" }} />
            <p style={{ fontSize: 12, fontWeight: 700, color: "#c9b99a" }}>사주500</p>
            <p style={{ fontSize: 10, color: "#c9bba8", marginTop: 4 }}>전통 명리학 데이터 기반 AI 사주 분석 리포트</p>
            <p style={{ fontSize: 10, color: "#d4ccc0", marginTop: 2 }}>© 2026 사주500. 참고용이며 전문 상담을 대체하지 않습니다.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
