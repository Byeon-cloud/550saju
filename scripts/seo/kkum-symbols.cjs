/* 꿈해몽 검색 페이지에 올릴 꿈 목록 (2026-10-17, 시험 E10) — 사람이 고른 목록. AI 는 문장만 쓴다.
 *   slug: 주소 /kkum/{slug}/ · name: 검색어 그대로 · cat: 앱 꿈해몽 분류(DreamPage DREAM_CATEGORIES id)
 *   oheng: 오행이 분명한 상징만 적는다(12지 동물은 그 지지, 물=수, 불=화, 꽃과 나무=목, 산과 땅=토, 쇠붙이=금). 모르면 비운다.
 *   cases: 검색에 실제로 나오는 상황. 이 순서대로 풀이가 나간다. */
module.exports = [
  // 동물이 나오는 꿈
  { slug: 'snake', name: '뱀 꿈', cat: 'animal', oheng: '화(巳, 뱀띠의 글자)', cases: ['뱀에게 물리는 꿈', '큰 뱀이 나오는 꿈', '하얀 뱀 꿈', '뱀이 집에 들어오는 꿈', '뱀을 죽이는 꿈', '뱀이 몸을 감는 꿈', '뱀이 여러 마리 나오는 꿈'] },
  { slug: 'pig', name: '돼지꿈', cat: 'animal', oheng: '수(亥, 돼지띠의 글자)', cases: ['돼지가 집에 들어오는 꿈', '새끼 돼지 꿈', '돼지를 안는 꿈', '돼지에게 물리는 꿈', '황금 돼지 꿈', '돼지가 도망가는 꿈', '죽은 돼지 꿈'] },
  { slug: 'tiger', name: '호랑이 꿈', cat: 'animal', oheng: '목(寅, 호랑이띠의 글자)', cases: ['호랑이가 집에 들어오는 꿈', '호랑이에게 쫓기는 꿈', '호랑이에게 물리는 꿈', '새끼 호랑이 꿈', '백호(하얀 호랑이) 꿈', '호랑이를 타는 꿈'] },
  { slug: 'dragon', name: '용꿈', cat: 'animal', oheng: '토(辰, 용띠의 글자)', cases: ['용이 하늘로 올라가는 꿈', '용을 타는 꿈', '황룡 꿈', '청룡 꿈', '용이 물에서 나오는 꿈', '용이 떨어지는 꿈'] },
  { slug: 'dog', name: '개 꿈', cat: 'animal', oheng: '토(戌, 개띠의 글자)', cases: ['개에게 물리는 꿈', '강아지 꿈', '하얀 개 꿈', '검은 개 꿈', '개가 따라오는 꿈', '개가 죽는 꿈'] },
  { slug: 'cat', name: '고양이 꿈', cat: 'animal', oheng: '', cases: ['고양이에게 할퀴는 꿈', '새끼 고양이 꿈', '검은 고양이 꿈', '하얀 고양이 꿈', '고양이가 집에 들어오는 꿈', '고양이를 안는 꿈'] },
  { slug: 'rat', name: '쥐 꿈', cat: 'animal', oheng: '수(子, 쥐띠의 글자)', cases: ['쥐가 집에 많은 꿈', '쥐에게 물리는 꿈', '쥐를 잡는 꿈', '하얀 쥐 꿈', '쥐가 도망가는 꿈'] },
  { slug: 'cow', name: '소 꿈', cat: 'animal', oheng: '토(丑, 소띠의 글자)', cases: ['소가 집에 들어오는 꿈', '황소 꿈', '송아지 꿈', '소를 끌고 가는 꿈', '소에게 받히는 꿈'] },
  { slug: 'horse', name: '말 꿈', cat: 'animal', oheng: '화(午, 말띠의 글자)', cases: ['말을 타는 꿈', '백마 꿈', '말이 달리는 꿈', '말에서 떨어지는 꿈', '말이 집에 들어오는 꿈'] },
  { slug: 'fish', name: '물고기 꿈', cat: 'animal', oheng: '수(물에 사는 것)', cases: ['물고기를 잡는 꿈', '큰 물고기 꿈', '잉어 꿈', '금붕어 꿈', '물고기가 죽는 꿈', '물고기를 받는 꿈'] },
  { slug: 'turtle', name: '거북이 꿈', cat: 'animal', oheng: '', cases: ['거북이가 집에 들어오는 꿈', '큰 거북이 꿈', '거북이를 잡는 꿈', '거북이를 놓아주는 꿈', '거북이가 물로 가는 꿈'] },
  { slug: 'bird', name: '새 꿈', cat: 'animal', oheng: '', cases: ['새가 집에 들어오는 꿈', '새를 잡는 꿈', '까치 꿈', '까마귀 꿈', '봉황 꿈', '새가 죽는 꿈'] },
  { slug: 'chicken', name: '닭 꿈', cat: 'animal', oheng: '금(酉, 닭띠의 글자)', cases: ['닭이 우는 꿈', '닭이 알을 낳는 꿈', '닭을 잡는 꿈', '병아리 꿈', '닭에게 쪼이는 꿈'] },
  { slug: 'bug', name: '벌레 꿈', cat: 'animal', oheng: '', cases: ['구더기 꿈', '바퀴벌레 꿈', '벌레가 몸에 붙는 꿈', '벌레를 죽이는 꿈', '벌레가 많은 꿈'] },
  { slug: 'spider', name: '거미 꿈', cat: 'animal', oheng: '', cases: ['큰 거미 꿈', '거미줄 꿈', '거미에게 물리는 꿈', '거미를 죽이는 꿈'] },
  { slug: 'bear', name: '곰 꿈', cat: 'animal', oheng: '', cases: ['곰에게 쫓기는 꿈', '아기 곰 꿈', '곰을 안는 꿈', '곰이 집에 들어오는 꿈', '흰 곰 꿈'] },
  { slug: 'rabbit', name: '토끼 꿈', cat: 'animal', oheng: '목(卯, 토끼띠의 글자)', cases: ['하얀 토끼 꿈', '토끼를 안는 꿈', '토끼를 잡는 꿈', '토끼가 도망가는 꿈'] },
  // 물과 관련된 꿈
  { slug: 'water', name: '물 꿈', cat: 'water', oheng: '수', cases: ['맑은 물 꿈', '흙탕물 꿈', '물이 넘치는 꿈', '물을 마시는 꿈', '집에 물이 차는 꿈'] },
  { slug: 'flood', name: '홍수 꿈', cat: 'water', oheng: '수', cases: ['홍수에 집이 잠기는 꿈', '홍수에 휩쓸리는 꿈', '홍수를 피하는 꿈', '맑은 물 홍수 꿈'] },
  { slug: 'sea', name: '바다 꿈', cat: 'water', oheng: '수', cases: ['맑은 바다 꿈', '파도가 치는 꿈', '해일 꿈', '바다에 들어가는 꿈', '바다를 건너는 꿈'] },
  { slug: 'rain', name: '비 오는 꿈', cat: 'water', oheng: '수', cases: ['비를 맞는 꿈', '폭우 꿈', '우산을 쓰는 꿈', '비가 그치는 꿈'] },
  { slug: 'drown', name: '물에 빠지는 꿈', cat: 'water', oheng: '수', cases: ['내가 물에 빠지는 꿈', '물에 빠졌다가 나오는 꿈', '다른 사람이 물에 빠지는 꿈', '물에 빠진 사람을 구하는 꿈'] },
  // 죽음, 이별의 꿈
  { slug: 'death', name: '죽는 꿈', cat: 'death', oheng: '', cases: ['내가 죽는 꿈', '죽었다가 살아나는 꿈', '남이 죽는 꿈', '사람을 죽이는 꿈'] },
  { slug: 'family-death', name: '가족이 죽는 꿈', cat: 'death', oheng: '', cases: ['엄마가 죽는 꿈', '아빠가 죽는 꿈', '남편이 죽는 꿈', '아내가 죽는 꿈', '자식이 죽는 꿈'] },
  { slug: 'corpse', name: '시체 꿈', cat: 'death', oheng: '', cases: ['시체를 보는 꿈', '시체를 만지는 꿈', '시체가 집에 있는 꿈', '시체를 옮기는 꿈'] },
  { slug: 'funeral', name: '장례식 꿈', cat: 'death', oheng: '', cases: ['장례식에 가는 꿈', '내 장례식 꿈', '상복을 입는 꿈', '관 꿈'] },
  { slug: 'ancestor', name: '돌아가신 분 꿈', cat: 'death', oheng: '', cases: ['돌아가신 할머니 꿈', '돌아가신 아버지 꿈', '돌아가신 엄마 꿈', '돌아가신 분이 웃는 꿈', '돌아가신 분이 화내는 꿈', '조상 꿈'] },
  { slug: 'ex', name: '헤어진 연인 꿈', cat: 'death', oheng: '', cases: ['전 남자친구 꿈', '전 여자친구 꿈', '헤어진 사람과 다시 만나는 꿈', '헤어진 사람이 결혼하는 꿈', '헤어진 사람이 자꾸 나오는 꿈'] },
  // 사람이 나오는 꿈
  { slug: 'celebrity', name: '연예인 꿈', cat: 'people', oheng: '', cases: ['연예인과 사귀는 꿈', '연예인과 대화하는 꿈', '연예인에게 선물 받는 꿈', '대통령 꿈'] },
  { slug: 'wedding', name: '결혼하는 꿈', cat: 'people', oheng: '', cases: ['내가 결혼하는 꿈', '모르는 사람과 결혼하는 꿈', '애인이 다른 사람과 결혼하는 꿈', '결혼식에 가는 꿈', '웨딩드레스 꿈'] },
  { slug: 'pregnant', name: '임신하는 꿈', cat: 'people', oheng: '', cases: ['내가 임신하는 꿈', '남이 임신하는 꿈', '쌍둥이 임신 꿈', '출산하는 꿈'] },
  { slug: 'baby', name: '아기 꿈', cat: 'people', oheng: '', cases: ['아기를 안는 꿈', '아기가 웃는 꿈', '아기가 우는 꿈', '아기를 잃어버리는 꿈', '아기를 낳는 꿈'] },
  { slug: 'ghost', name: '귀신 꿈', cat: 'people', oheng: '', cases: ['귀신에게 쫓기는 꿈', '귀신과 싸우는 꿈', '귀신이 집에 있는 꿈', '가위 눌리는 꿈'] },
  { slug: 'fight', name: '싸우는 꿈', cat: 'people', oheng: '', cases: ['가족과 싸우는 꿈', '애인과 싸우는 꿈', '모르는 사람과 싸우는 꿈', '싸워서 이기는 꿈', '맞는 꿈'] },
  // 하늘을 나는 꿈, 쫓기는 꿈
  { slug: 'flying', name: '하늘을 나는 꿈', cat: 'flying', oheng: '', cases: ['높이 나는 꿈', '낮게 나는 꿈', '날다가 떨어지는 꿈', '비행기 타는 꿈'] },
  { slug: 'falling', name: '떨어지는 꿈', cat: 'flying', oheng: '', cases: ['높은 곳에서 떨어지는 꿈', '절벽에서 떨어지는 꿈', '엘리베이터가 떨어지는 꿈', '떨어지다 깨는 꿈'] },
  { slug: 'chased', name: '쫓기는 꿈', cat: 'chase', oheng: '', cases: ['누군가에게 쫓기는 꿈', '쫓기다가 숨는 꿈', '쫓기다가 잡히는 꿈', '도망치다 깨는 꿈'] },
  { slug: 'lost', name: '길을 잃는 꿈', cat: 'chase', oheng: '', cases: ['낯선 곳에서 길을 잃는 꿈', '집을 못 찾는 꿈', '차를 놓치는 꿈', '아는 길이 바뀌는 꿈'] },
  // 돈, 재물의 꿈
  { slug: 'money', name: '돈 꿈', cat: 'money', oheng: '', cases: ['돈을 줍는 꿈', '돈을 받는 꿈', '돈을 잃어버리는 꿈', '돈을 세는 꿈', '동전 꿈'] },
  { slug: 'gold', name: '금 꿈', cat: 'money', oheng: '금', cases: ['금반지 꿈', '금목걸이 꿈', '금덩어리 꿈', '금을 줍는 꿈', '금을 잃어버리는 꿈'] },
  { slug: 'lottery', name: '복권 당첨 꿈', cat: 'money', oheng: '', cases: ['로또 당첨 꿈', '복권을 사는 꿈', '숫자가 보이는 꿈', '당첨됐다가 깨는 꿈'] },
  { slug: 'poop', name: '똥꿈', cat: 'money', oheng: '', cases: ['똥을 밟는 꿈', '똥이 몸에 묻는 꿈', '똥을 싸는 꿈', '화장실이 넘치는 꿈', '똥을 치우는 꿈'] },
  { slug: 'teeth', name: '이빨 빠지는 꿈', cat: 'other', oheng: '', cases: ['앞니가 빠지는 꿈', '어금니가 빠지는 꿈', '이빨이 흔들리는 꿈', '이빨이 썩는 꿈', '피 흘리며 이빨 빠지는 꿈'] },
  { slug: 'hair', name: '머리카락 꿈', cat: 'other', oheng: '', cases: ['머리카락을 자르는 꿈', '머리카락이 빠지는 꿈', '흰머리 꿈', '머리가 길어지는 꿈'] },
  { slug: 'blood', name: '피 꿈', cat: 'other', oheng: '', cases: ['피를 흘리는 꿈', '피를 보는 꿈', '코피 꿈', '옷에 피가 묻는 꿈'] },
  // 자연, 날씨 꿈
  { slug: 'fire', name: '불 꿈', cat: 'nature', oheng: '화', cases: ['집에 불이 나는 꿈', '불을 끄는 꿈', '산불 꿈', '불에 타는 꿈', '불꽃이 크게 일어나는 꿈'] },
  { slug: 'flower', name: '꽃 꿈', cat: 'nature', oheng: '목', cases: ['꽃을 받는 꿈', '꽃이 피는 꿈', '꽃밭 꿈', '꽃이 시드는 꿈', '꽃을 꺾는 꿈'] },
  { slug: 'fruit', name: '과일 꿈', cat: 'nature', oheng: '목(나무 열매)', cases: ['복숭아 꿈', '사과 꿈', '감 꿈', '과일을 따는 꿈', '과일을 받는 꿈'] },
  { slug: 'mountain', name: '산 꿈', cat: 'nature', oheng: '토', cases: ['산에 오르는 꿈', '산 정상 꿈', '산에서 내려오는 꿈', '산이 무너지는 꿈'] },
  { slug: 'snow', name: '눈 오는 꿈', cat: 'nature', oheng: '수(겨울 물)', cases: ['함박눈 꿈', '눈을 맞는 꿈', '눈이 쌓이는 꿈', '눈이 녹는 꿈'] },
  { slug: 'earthquake', name: '지진 꿈', cat: 'nature', oheng: '토', cases: ['땅이 갈라지는 꿈', '건물이 무너지는 꿈', '지진을 피하는 꿈'] },
  { slug: 'sun-moon', name: '해와 달 꿈', cat: 'nature', oheng: '', cases: ['해가 뜨는 꿈', '해를 품는 꿈', '보름달 꿈', '달이 두 개 뜨는 꿈', '해가 지는 꿈'] },
  // 그 밖의 꿈
  { slug: 'exam', name: '시험 보는 꿈', cat: 'other', oheng: '', cases: ['시험에 늦는 꿈', '시험을 망치는 꿈', '시험에 붙는 꿈', '답을 못 쓰는 꿈'] },
  { slug: 'shoes', name: '신발 꿈', cat: 'other', oheng: '', cases: ['신발을 잃어버리는 꿈', '새 신발 꿈', '신발이 바뀌는 꿈', '맨발로 걷는 꿈'] },
  { slug: 'house', name: '집 꿈', cat: 'other', oheng: '', cases: ['이사 가는 꿈', '새집 꿈', '큰 집 꿈', '집이 무너지는 꿈', '옛날 집 꿈'] },
  { slug: 'car', name: '차 꿈', cat: 'other', oheng: '', cases: ['차 사고 꿈', '차를 운전하는 꿈', '차를 잃어버리는 꿈', '새 차 꿈', '브레이크가 안 듣는 꿈'] },
  { slug: 'knife', name: '칼 꿈', cat: 'other', oheng: '금', cases: ['칼에 찔리는 꿈', '칼을 받는 꿈', '칼을 휘두르는 꿈', '칼을 줍는 꿈'] },
];
