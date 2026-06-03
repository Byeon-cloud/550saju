import { useEffect } from 'react';

/**
 * useSeoMeta — 공개(검색 노출) 페이지의 SEO 메타를 라우트 진입 시 동적 갱신.
 *
 * SPA 라 정적 index.html 메타는 첫 진입 화면(`/`) 기준으로만 박혀 있다.
 * 공개 페이지(오늘운세·꿈해몽·주제분석 등)는 각자 다른 title/description 이 필요하므로,
 * 이 훅이 `document.title` + `<meta name="description">` + `og:title`/`og:description` 을
 * 라우트마다 덮어쓴다. 없으면 생성한다.
 *
 * cleanup 은 두지 않는다 — 다음 페이지의 useSeoMeta 가 다시 덮어쓰는 구조라 잔재가 없다.
 * (title 만 다루는 기존 usePageTitle 과 공존 가능. title 인자를 넘기지 않으면 title 은 건드리지 않는다.)
 */

const BASE = '사주500';

/** name 속성 메타 태그를 찾거나 만들어 content 설정 */
function setNamedMeta(name: string, content: string): void {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute('name', name);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

/** property 속성 메타 태그(OG)를 찾거나 만들어 content 설정 */
function setPropertyMeta(property: string, content: string): void {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[property="${property}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute('property', property);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

export interface SeoMeta {
  /** 페이지 제목 (BASE 와 결합). 미지정 시 title 은 건드리지 않음 (usePageTitle 과 공존). */
  title?: string;
  /** 검색결과·OG 설명문 */
  description?: string;
}

export function useSeoMeta({ title, description }: SeoMeta): void {
  useEffect(() => {
    const fullTitle = title ? `${title} — ${BASE}` : undefined;

    if (fullTitle) {
      document.title = fullTitle;
      setPropertyMeta('og:title', fullTitle);
    }

    if (description) {
      setNamedMeta('description', description);
      setPropertyMeta('og:description', description);
    }
  }, [title, description]);
}
