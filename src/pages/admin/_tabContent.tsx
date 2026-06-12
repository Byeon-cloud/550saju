// 어드민 — ③ 콘텐츠 탭 (2026-06-10)
//   콘텐츠별 퍼널 테이블(open→result→purchase 전환율) + topic_select 인기 + 생성 누적
import { useMemo } from 'react';
import { BarChart, Bar, LineChart, Line, Legend, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import type { AdminData } from './_useAdminData';
import {
  C, Section, Empty, CsvButton, DataTable, deltaPct, fmtNum, fmtPct,
  CONTENT_LABEL, CONTENT_COLORS,
} from './_components';
import type { Col } from './_components';
import { buildCsv, downloadCsv, csvFilename } from './_csv';

export function TabContent({ d }: { d: AdminData }) {
  const { cur, prev } = d;

  // 콘텐츠별 퍼널 — purchase 는 topic:xxx 를 base type 으로 합산
  const purchaseByType = useMemo(() => {
    const out: Record<string, number> = {};
    Object.entries(cur.contentPurchase).forEach(([key, v]) => {
      const base = key.startsWith('topic:') ? 'topic' : key;
      out[base] = (out[base] ?? 0) + v.count;
    });
    return out;
  }, [cur.contentPurchase]);

  const funnelRows = useMemo(() => {
    const types = new Set([
      ...Object.keys(cur.contentOpen), ...Object.keys(cur.contentResult), ...Object.keys(purchaseByType),
    ]);
    return Array.from(types).map((t) => {
      const open = cur.contentOpen[t] ?? 0;
      const result = cur.contentResult[t] ?? 0;
      const purchase = purchaseByType[t] ?? 0;
      return {
        label: CONTENT_LABEL[t] || t,
        open,
        result,
        resultRate: open > 0 ? Math.round((result / open) * 100) : null,
        purchase,
        purchaseRate: result > 0 ? Math.round((purchase / result) * 100) : null,
        prevOpen: prev.contentOpen[t] ?? 0,
        delta: deltaPct(open, prev.contentOpen[t] ?? 0),
      };
    }).sort((a, b) => b.open - a.open);
  }, [cur, prev, purchaseByType]);

  const funnelCols: Col[] = [
    { key: 'label', label: '콘텐츠' },
    { key: 'open', label: '진입', numeric: true },
    { key: 'result', label: '결과 도달', numeric: true },
    { key: 'resultRate', label: '도달률', numeric: true, render: (v) => fmtPct(v) },
    { key: 'purchase', label: '구매(운)', numeric: true },
    { key: 'purchaseRate', label: '구매전환', numeric: true, render: (v) => fmtPct(v) },
    { key: 'delta', label: '진입 증감', numeric: true, render: (v) => fmtPct(v) },
  ];

  // 인기 주제 — 진입(topic_open) 기준 정렬 + 결제확정(topic_select) 병기 (2026-06-12)
  const topicBars = useMemo(() => {
    const keys = new Set([...Object.keys(cur.topicOpen), ...Object.keys(cur.topicSelect)]);
    return Array.from(keys)
      .map((topic) => ({
        label: topic,
        n: cur.topicOpen[topic] ?? 0,
        sel: cur.topicSelect[topic] ?? 0,
        prevN: prev.topicOpen[topic] ?? 0,
      }))
      .sort((a, b) => (b.n + b.sel) - (a.n + a.sel))
      .slice(0, 12);
  }, [cur.topicOpen, cur.topicSelect, prev.topicOpen, prev.topicSelect]);

  // 생성 누적 (reports)
  const reportChips = useMemo(() =>
    Object.entries(d.reportsByType)
      .map(([t, n]) => ({ label: CONTENT_LABEL[t] || t, n }))
      .sort((a, b) => b.n - a.n),
  [d.reportsByType]);

  const exportCsv = () => {
    const headers = ['콘텐츠', '진입', '결과도달', '도달률%', '구매', '구매전환%', '전기간진입'];
    const rows = funnelRows.map((r) => [r.label, r.open, r.result, r.resultRate ?? '', r.purchase, r.purchaseRate ?? '', r.prevOpen]);
    downloadCsv(csvFilename('content_funnel', cur.days[0], cur.days[cur.days.length - 1]), buildCsv(headers, rows));
  };

  return (
    <div>
      <Section
        title="콘텐츠별 퍼널 (진입 → 결과 → 구매)"
        right={<CsvButton onClick={exportCsv} label="퍼널 CSV" />}
        caption="· 도달률 = 결과/진입 · 구매전환 = 구매/결과 (무료 콘텐츠는 구매 0 정상) · 주제분석 구매는 topic 합산"
      >
        <DataTable columns={funnelCols} rows={funnelRows} initialSortKey="open" />
      </Section>

      <Section
        title="전 콘텐츠 분포 (DB 복원 — 전 기간)"
        caption="· 종합사주~토정 = reports / 오늘운세 = dailyFortune 문서 / 꿈해몽무료·사주대화 = AI 호출 기록 (6/10부터·유저 수 집계불가는 —)"
      >
        {(() => {
          const DIST_LABEL: Record<string, string> = {
            premium: '종합사주', report: '종합사주(구)', basic: '1운 리포트', topic: '주제분석',
            daily: '오늘의 운세', deepDream: '꿈해몽 유료(심층)', dreamFree: '꿈해몽 무료', chat: '사주대화',
            daeun: '대운', monthly: '월운', compatibility: '궁합', compat: '궁합', tojung: '토정비결', weekly: '주간(폐지)',
          };
          const rows = Object.entries(d.contentDistAll || {})
            .map(([t, v]) => ({ t, label: DIST_LABEL[t] || t, count: v.count, users: v.users }))
            .sort((a, b) => b.count - a.count);
          if (rows.length === 0) return <Empty />;
          const max = rows[0].count || 1;
          return (
            <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 16, padding: '14px 16px' }}>
              {rows.map((r, i) => (
                <div key={r.t} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0' }}>
                  <span style={{ width: 110, fontSize: 12, fontWeight: 700, color: C.ink, flexShrink: 0 }}>{r.label}</span>
                  <div style={{ flex: 1, height: 14, background: '#F3EFE6', borderRadius: 7, overflow: 'hidden' }}>
                    <div style={{ width: `${Math.max(3, Math.round((r.count / max) * 100))}%`, height: '100%', background: CONTENT_COLORS[i % CONTENT_COLORS.length], borderRadius: 7 }} />
                  </div>
                  <span style={{ width: 130, fontSize: 12, color: C.ink, textAlign: 'right', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                    <b>{fmtNum(r.count)}건</b>
                    <span style={{ color: C.mute }}> {r.users == null ? '(유저 —)' : `(${fmtNum(r.users)}명)`}</span>
                  </span>
                </div>
              ))}
            </div>
          );
        })()}
      </Section>

      <Section
        title="10주제 분포 (DB 복원 — 전 기간)"
        caption="· reports 의 topicId 기준 — 과거 포함 전체. 괄호 = 고유 유저 / [기간 N] = 선택한 기간 내 생성"
      >
        {(() => {
          const TOPIC_KR: Record<string, string> = {
            love: '연애운', reunion: '재회운', marriage: '결혼운', wealth: '재물운', exam: '합격이직운',
            business: '사업운', health: '건강운', move: '이사운', moving: '이사운', study: '학업운', career: '직업운',
          };
          const rows = Object.entries(d.topicDistAll || {})
            .map(([tid, v]) => ({ tid, label: TOPIC_KR[tid] || tid, count: v.count, users: v.users, period: cur.topicGen[tid] ?? 0 }))
            .sort((a, b) => b.count - a.count);
          if (rows.length === 0) return <Empty />;
          const max = rows[0].count || 1;
          return (
            <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 16, padding: '14px 16px' }}>
              {rows.map((r, i) => (
                <div key={r.tid} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0' }}>
                  <span style={{ width: 76, fontSize: 12, fontWeight: 700, color: C.ink, flexShrink: 0 }}>{r.label}</span>
                  <div style={{ flex: 1, height: 14, background: '#F3EFE6', borderRadius: 7, overflow: 'hidden' }}>
                    <div style={{ width: `${Math.max(3, Math.round((r.count / max) * 100))}%`, height: '100%', background: CONTENT_COLORS[i % CONTENT_COLORS.length], borderRadius: 7 }} />
                  </div>
                  <span style={{ width: 150, fontSize: 12, color: C.ink, textAlign: 'right', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                    <b>{fmtNum(r.count)}건</b>
                    <span style={{ color: C.mute }}> ({fmtNum(r.users)}명)</span>
                    <span style={{ color: C.goldDeep, fontWeight: 700 }}> [기간 {fmtNum(r.period)}]</span>
                  </span>
                </div>
              ))}
              {/* 소분류 분포 (2026-06-12) — 솔로/썸/연애중 · 상대유무 · 창업준비/운영중 */}
              {Object.keys(d.topicSubAll || {}).length > 0 && (
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px dashed ${C.line}` }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: C.goldDeep, marginBottom: 6 }}>소분류 분포</p>
                  {Object.entries(d.topicSubAll).map(([tid, subs]) => {
                    const TOPIC_KR2: Record<string, string> = {
                      love: '연애운', reunion: '재회운', marriage: '결혼운', wealth: '재물운', exam: '합격이직운',
                      business: '사업운', health: '건강운', move: '이사운', moving: '이사운', study: '학업운', career: '직업운',
                    };
                    return (
                      <div key={tid} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0', flexWrap: 'wrap' }}>
                        <span style={{ width: 76, fontSize: 12, fontWeight: 700, color: C.ink, flexShrink: 0 }}>{TOPIC_KR2[tid] || tid}</span>
                        {Object.entries(subs).sort((a, b) => b[1] - a[1]).map(([sub, n]) => (
                          <span key={sub} style={{ fontSize: 11, padding: '2px 10px', borderRadius: 100, background: 'rgba(184,150,90,0.10)', color: C.goldDeep, fontWeight: 700 }}>
                            {sub} {fmtNum(n)}
                          </span>
                        ))}
                      </div>
                    );
                  })}
                  <p style={{ fontSize: 10, color: C.mute, marginTop: 4 }}>· 연애 솔로/썸/연애중 = 결과 구조 역산(과거)+입력값(신규) · 결혼 = 상대 입력 유무 · 사업 창업준비/운영중 = 신규부터</p>
                </div>
              )}
            </div>
          );
        })()}
      </Section>

      <Section title="인기 주제 (진입 → 결제확정)" caption="· 막대 = 주제 페이지 진입(topic_open) · 툴팁의 '확정' = 운 차감 확정(topic_select) — 어떤 운을 보고, 어떤 운에 돈을 쓰는지">
        {topicBars.length === 0 ? <Empty /> : (
          <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 16, padding: '16px 8px 8px' }}>
            <ResponsiveContainer width="100%" height={Math.max(120, topicBars.length * 36)}>
              <BarChart data={topicBars} layout="vertical" margin={{ left: 8, right: 16 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="label" width={80} tick={{ fontSize: 12, fill: C.ink }} />
                <Tooltip formatter={(v: any, _n: any, p: any) => [`진입 ${fmtNum(Number(v))}회 · 확정 ${fmtNum(p?.payload?.sel ?? 0)}회 (전기간 진입 ${fmtNum(p?.payload?.prevN ?? 0)})`, '주제']} />
                <Bar dataKey="n" radius={[0, 6, 6, 0]}>
                  {topicBars.map((_, i) => <Cell key={i} fill={CONTENT_COLORS[i % CONTENT_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Section>

      <Section
        title="CTA 클릭 TOP 20 (cta_click)"
        caption="· 전 화면 버튼·링크 클릭 자동 수집 (라벨 = 버튼 텍스트) — 어떤 버튼이 실제로 눌리는지"
      >
        {(() => {
          const total = cur.ctaTotal || 0;
          const rows = Object.entries(cur.cta)
            .map(([label, n]) => ({
              label, n,
              share: total > 0 ? Math.round((n / total) * 1000) / 10 : 0,
              prevN: prev.cta[label] ?? 0,
              delta: deltaPct(n, prev.cta[label] ?? 0),
            }))
            .sort((a, b) => b.n - a.n)
            .slice(0, 20);
          const cols: Col[] = [
            { key: 'label', label: 'CTA (버튼 텍스트)' },
            { key: 'n', label: '클릭', numeric: true },
            { key: 'share', label: '비중', numeric: true, render: (v) => `${v}%` },
            { key: 'prevN', label: '전기간', numeric: true },
            { key: 'delta', label: '증감', numeric: true, render: (v) => fmtPct(v) },
          ];
          return <DataTable columns={cols} rows={rows} initialSortKey="n" />;
        })()}
      </Section>

      <Section title="콘텐츠 생성 추이 (DB 복원 — 과거 포함)" caption="· reports.generatedAt 역산 — 행동로그 수집 이전 기간도 표시. 어떤 콘텐츠가 언제 많이 생성됐는지">
        {(() => {
          const topTypes = Object.entries(cur.genByDayType)
            .map(([t, arr]) => ({ t, sum: arr.reduce((a, b) => a + b, 0) }))
            .sort((a, b) => b.sum - a.sum).slice(0, 5).map((x) => x.t);
          const series = cur.days.map((day, i) => {
            const pt: Record<string, any> = { day: day.slice(5), total: cur.genByDay[i] };
            topTypes.forEach((t) => { pt[t] = cur.genByDayType[t]?.[i] ?? 0; });
            return pt;
          });
          if (cur.genTotal === 0) return <Empty />;
          return (
            <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 16, padding: '16px 8px 8px' }}>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={series} margin={{ left: 0, right: 8 }}>
                  <XAxis dataKey="day" tick={{ fontSize: 10, fill: C.mute }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 10, fill: C.mute }} width={32} allowDecimals={false} />
                  <Tooltip formatter={(v: any, name: any) => [`${fmtNum(Number(v))}건`, CONTENT_LABEL[String(name)] || String(name)]} />
                  <Legend wrapperStyle={{ fontSize: 11 }} formatter={(v) => CONTENT_LABEL[String(v)] || String(v)} />
                  {topTypes.map((t, i) => (
                    <Line key={t} type="monotone" dataKey={t} stroke={CONTENT_COLORS[i % CONTENT_COLORS.length]} strokeWidth={2} dot={false} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          );
        })()}
      </Section>

      <Section title="콘텐츠 생성 누적 (결제·무료 합산)" caption="· reports 컬렉션 contentType 기준 — 전 기간 누적">
        {reportChips.length === 0 ? <Empty /> : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {reportChips.map((r) => (
              <div key={r.label} style={{ padding: '8px 14px', background: C.surface, border: `1px solid ${C.line}`, borderRadius: 100, fontSize: 12 }}>
                <b style={{ color: C.ink }}>{r.label}</b>{' '}
                <span style={{ color: C.goldDeep, fontWeight: 700 }}>{fmtNum(r.n)}</span>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}
