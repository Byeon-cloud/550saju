"""
토스 앱 링크 만들기 (2026-10-27, 시험 E39) — 앱 밖에서 '누르면 토스 앱 사주500 의 그 화면이 열리는' https 링크를 만든다.

getTossShareLink 는 앱 안에서만 부를 수 있다. 그 결과(minion.toss.im 짧은 링크)를 펼치면
  og.toss.im/?returnUrl=toss.onelink.me/...?af_dp=...&deep_link_value=...
처럼 열 화면 주소(landingUrl, intoss://saju-500...)를 몇 겹으로 감싼 링크다. 기존 홈 링크(minion.toss.im/htCN4Llr)의
껍질을 그대로 두고 landingUrl 만 바꿔 다시 감싼다. 겹마다 인코딩 횟수를 원본과 똑같이 맞춘다.

  python scripts/ops/toss_app_link.py /premium meta paid e39 V4_toss
  → 첫 줄: 만든 링크, 둘째 줄: 되풀어 본 landingUrl (확인용)
"""
import sys
from urllib.parse import quote, unquote, urlencode, parse_qsl, urlsplit

BASE = (
    "https://og.toss.im/?returnUrl=https%3A%2F%2Ftoss.onelink.me%2F3563614660%3Fpid%3Dappsintoss%26c%3Dconversion_aepintoseu_performance"
    "%26af_adset%3Dshare_link_20260601%26af_ad%3D054038%26is_retargeting%3Dtrue%26af_web_dp%3Dhttps%3A%2F%2Ftoss.im"
    "%26af_dp%3D{DP}%26deep_link_value%3D{DP}%26af_force_deeplink%3Dtrue"
    "&title=%ED%86%A0%EC%8A%A4+%EC%82%AC%EC%A3%BC+500&description=%EC%95%B1+%EC%84%A4%EC%B9%98+%EC%97%86%EC%9D%B4+%EC%93%B0%EB%8A%94+%ED%86%A0%EC%8A%A4+%EB%AF%B8%EB%8B%88%EC%95%B1"
    "&imageUrl=https%3A%2F%2Fstatic.toss.im%2Fillusts%2F250903-101.png"
)
# 원본의 DP(af_dp, deep_link_value 값, og.toss.im 주소 안에서 보이는 그대로)
ORIG_DP = (
    "supertoss%253A%252F%252Ftotal-services%253Fredirect%253Dservicetoss%25253A%25252F%25252Fapp-mini-home%25252Flanding%25253F%25253DlandingUrl%25253D"
    "intoss%2525253A%2525252F%2525252Fsaju-500%2525253Freferrer%2525253Dappsintoss.common_module_share%25252526iconUri%2525253D"
    "https%252525253A%252525252F%252525252Fstatic.toss.im%252525252Fappsintoss%252525252F9919%252525252Ff3c5c652-2507-4401-94f0-45495e0f9fb3.png"
)
ICON = "https://static.toss.im/appsintoss/9919/f3c5c652-2507-4401-94f0-45495e0f9fb3.png"


def enc(s: str, times: int) -> str:
    for _ in range(times):
        s = quote(s, safe='')
    return s


def build_dp(landing: str) -> str:
    """landingUrl(날것) → og.toss.im 주소 안에 들어갈 DP 문자열. 원본과 같은 겹으로 감싼다"""
    # 원본에서 겹 수를 읽는다: landingUrl 은 DP 안에서 'intoss%2525253A' = ':' 를 5번 인코딩 (25 25 25 3A → %2525253A 는 4번 더 감싼 것)
    # 구조: supertoss://total-services?redirect=<servicetoss://app-mini-home/landing?=landingUrl=<landing>>
    inner = "servicetoss://app-mini-home/landing?=landingUrl=" + quote(landing, safe='')
    dp_raw = "supertoss://total-services?redirect=" + quote(inner, safe='')
    # dp_raw 를 onelink 쿼리 값으로 한 번(enc 1), onelink 주소를 returnUrl 값으로 한 번 더(enc 1)
    return enc(dp_raw, 2)


def landing_of(dp_in_og: str) -> str:
    dp_raw = unquote(unquote(dp_in_og))
    redirect = dict(parse_qsl(urlsplit(dp_raw).query))['redirect']
    # 'servicetoss://app-mini-home/landing?=landingUrl=<...>'
    return unquote(redirect.split('landingUrl=', 1)[1])


if __name__ == '__main__':
    orig_landing = landing_of(ORIG_DP)
    assert build_dp(orig_landing) == ORIG_DP, '원본 겹 맞추기 실패: ' + build_dp(orig_landing)
    path, src, med, camp, content = (sys.argv[1:6] + ['/', 'meta', 'paid', 'e39', 'V4_toss'][len(sys.argv[1:6]):])
    qs = urlencode({'utm_source': src, 'utm_medium': med, 'utm_campaign': camp, 'utm_content': content,
                    'referrer': 'appsintoss.common_module_share', 'iconUri': ICON})
    landing = f"intoss://saju-500{path if path != '/' else ''}?{qs}"
    dp = build_dp(landing)
    url = BASE.replace('{DP}', dp)
    print(url)
    print(landing_of(dp))
