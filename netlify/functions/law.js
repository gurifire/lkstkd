const https = require('https');
const OC_KEY = 'Daewoon';

// 소방 관련 키워드 — 우선순위 판별용
const FIRE_KEYWORDS = [
  '소방','화재','위험물','119','방화','소화','피난','소방공무원',
  '소방시설','소방기본','소방관','구조구급','화재예방','화재안전'
];

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function getTag(xml, tag) {
  const r = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`);
  const m = r.exec(xml);
  return m ? m[1].replace(/<!\[CDATA\[|\]\]>/g,'').trim() : '';
}

function isFire(name) {
  return FIRE_KEYWORDS.some(k => name.includes(k));
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json; charset=utf-8',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode:200, headers, body:'' };

  const { action, query, mst } = event.queryStringParameters || {};

  try {

    // ── ACTION: search ──────────────────────────────
    // 법제처 lawSearch로 관련 법령 목록 반환
    if (action === 'search') {
      if (!query) throw new Error('query 필요');

      const url = `https://www.law.go.kr/DRF/lawSearch.do?OC=${OC_KEY}&target=law&query=${encodeURIComponent(query)}&type=XML&display=10&search=1`;
      const xml = await httpsGet(url);

      const laws = [];
      const blocks = xml.match(/<법령>([\s\S]*?)<\/법령>/g) || [];

      for (const block of blocks) {
        const name    = getTag(block, '법령명_한글');
        const mstNum  = getTag(block, '법령일련번호');
        const kind    = getTag(block, '법종구분');
        const dept    = getTag(block, '소관부처명');
        const effDate = getTag(block, '시행일자');

        if (!name || !mstNum) continue;

        laws.push({
          name,
          mst: mstNum,
          kind,        // 법률 / 대통령령 / 총리령 / 부령 등
          dept,        // 소관부처
          effDate,     // 시행일자
          fire: isFire(name),
        });
      }

      // 소방 우선 정렬
      laws.sort((a,b) => (b.fire?1:0) - (a.fire?1:0));

      return { statusCode:200, headers, body: JSON.stringify({ laws, total: laws.length }) };
    }

    // ── ACTION: articles ────────────────────────────
    // 특정 법령의 조문 2개 반환
    if (action === 'articles') {
      if (!mst) throw new Error('mst 필요');

      const url = `https://www.law.go.kr/DRF/lawService.do?OC=${OC_KEY}&target=law&MST=${mst}&type=XML`;
      const xml = await httpsGet(url);

      // 법령명 추출
      const lawName = getTag(xml, '법령명_한글');

      const articles = [];
      const blocks = xml.match(/<조문단위[^>]*>([\s\S]*?)<\/조문단위>/g) || [];

      for (const block of blocks) {
        if (articles.length >= 2) break;

        const joYn = getTag(block, '조문여부');
        if (joYn !== '조문') continue;

        const num     = getTag(block, '조문번호');
        const title   = getTag(block, '조문제목');
        let   content = getTag(block, '조문내용');

        // 조문내용 없으면 첫 번째 항 내용 사용
        if (!content) {
          const hangM = /<항내용[^>]*>([\s\S]*?)<\/항내용>/.exec(block);
          if (hangM) content = hangM[1].replace(/<!\[CDATA\[|\]\]>/g,'').trim();
        }

        if (!num || !content || content.length < 3) continue;

        articles.push({
          num,
          title,
          content: content.replace(/\s+/g,' ').substring(0, 300),
          full: content.replace(/\s+/g,' '),
        });
      }

      return { statusCode:200, headers, body: JSON.stringify({ lawName, articles }) };
    }

    return { statusCode:400, headers, body: JSON.stringify({ error:'action 파라미터 필요 (search|articles)' }) };

  } catch(e) {
    return { statusCode:500, headers, body: JSON.stringify({ error: e.message }) };
  }
};
