// netlify/functions/data.js
//
// PARTFLOW 클라우드 이관용 범용 프록시 — 파트너/스케줄/출퇴근/업체정보 공용
//
// 사용법 (프론트엔드에서):
//   GET  /.netlify/functions/data?collection=PartflowPartners&businessKey=default
//        → 해당 businessKey의 전체 아이템 조회
//   POST /.netlify/functions/data   body: { collection, item: {...} }
//        → 새 아이템 삽입 (item.businessKey 필수)
//   PUT  /.netlify/functions/data   body: { collection, id, item: {...} }
//        → 기존 아이템 수정 (Wix 내부 _id로 upsert)
//   DELETE /.netlify/functions/data?collection=...&id=...
//        → 아이템 삭제
//
// 환경변수(WIX_API_KEY, WIX_SITE_ID)는 checkin.js와 동일한 값 그대로 재사용.

const WIX_API_KEY = process.env.WIX_API_KEY;
const WIX_SITE_ID = process.env.WIX_SITE_ID;

// 허용된 컬렉션만 접근 가능 (임의 컬렉션 접근 방지)
const ALLOWED_COLLECTIONS = [
  'PartflowPartners',
  'PartflowSchedule',
  'PartflowAttendance',
  'PartflowBiz'
];

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

function wixHeaders() {
  return {
    'Authorization': WIX_API_KEY,
    'wix-site-id': WIX_SITE_ID,
    'Content-Type': 'application/json'
  };
}

exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }
  if (!WIX_API_KEY || !WIX_SITE_ID) {
    return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: 'WIX_API_KEY / WIX_SITE_ID 환경변수가 설정되지 않았어요.' }) };
  }

  const qs = event.queryStringParameters || {};
  let body = {};
  try { body = event.body ? JSON.parse(event.body) : {}; } catch (e) {}

  const collection = qs.collection || body.collection;
  if (!collection || !ALLOWED_COLLECTIONS.includes(collection)) {
    return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: '허용되지 않은 컬렉션이에요: ' + collection }) };
  }

  try {
    if (event.httpMethod === 'GET') {
      const businessKey = qs.businessKey || 'default';
      const filter = { businessKey };
      if (qs.monthKey) filter.monthKey = qs.monthKey;
      if (qs.partnerId) filter.partnerId = qs.partnerId;

      const res = await fetch('https://www.wixapis.com/wix-data/v2/items/query', {
        method: 'POST',
        headers: wixHeaders(),
        body: JSON.stringify({
          dataCollectionId: collection,
          query: { filter, paging: { limit: 200, offset: 0 } }
        })
      });
      const data = await res.json();
      if (!res.ok) return { statusCode: res.status, headers: CORS_HEADERS, body: JSON.stringify(data) };
      const items = (data.dataItems || []).map(function (d) { return d.data; });
      return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ ok: true, items }) };
    }

    if (event.httpMethod === 'POST') {
      const item = body.item || {};
      if (!item.businessKey) item.businessKey = 'default';
      const res = await fetch('https://www.wixapis.com/wix-data/v2/items', {
        method: 'POST',
        headers: wixHeaders(),
        body: JSON.stringify({ dataCollectionId: collection, dataItem: { data: item } })
      });
      const data = await res.json();
      if (!res.ok) return { statusCode: res.status, headers: CORS_HEADERS, body: JSON.stringify(data) };
      return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ ok: true, item: data.dataItem }) };
    }

    if (event.httpMethod === 'PUT') {
      const id = body.id;
      const item = body.item || {};
      if (!id) return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'id가 필요해요.' }) };
      const res = await fetch('https://www.wixapis.com/wix-data/v2/items/' + id, {
        method: 'PUT',
        headers: wixHeaders(),
        body: JSON.stringify({ dataCollectionId: collection, dataItem: { data: item } })
      });
      const data = await res.json();
      if (!res.ok) return { statusCode: res.status, headers: CORS_HEADERS, body: JSON.stringify(data) };
      return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ ok: true, item: data.dataItem }) };
    }

    if (event.httpMethod === 'DELETE') {
      const id = qs.id;
      if (!id) return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'id가 필요해요.' }) };
      const res = await fetch('https://www.wixapis.com/wix-data/v2/items/' + id + '?dataCollectionId=' + collection, {
        method: 'DELETE',
        headers: wixHeaders()
      });
      if (!res.ok) {
        const data = await res.json();
        return { statusCode: res.status, headers: CORS_HEADERS, body: JSON.stringify(data) };
      }
      return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ ok: true }) };
    }

    return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) };
  } catch (err) {
    return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: String(err) }) };
  }
};
