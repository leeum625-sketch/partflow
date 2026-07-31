// netlify/functions/checkin.js
//
// PARTFLOW 케어 탭 — 체크인 데이터 저장/조회용 프록시

const WIX_API_KEY = process.env.WIX_API_KEY;
const WIX_SITE_ID = process.env.WIX_SITE_ID;
const COLLECTION_ID = 'PartflowCheckins';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }

  if (!WIX_API_KEY || !WIX_SITE_ID) {
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'WIX_API_KEY / WIX_SITE_ID 환경변수가 설정되지 않았어요.' })
    };
  }

  const wixHeaders = {
    'Authorization': WIX_API_KEY,
    'wix-site-id': WIX_SITE_ID,
    'Content-Type': 'application/json'
  };

  try {
    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const { staffId, staffName, mood, moodIndex, note, lang } = body;

      if (!staffId) {
        return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'staffId는 필수예요.' }) };
      }

      const res = await fetch('https://www.wixapis.com/wix-data/v2/items', {
        method: 'POST',
        headers: wixHeaders,
        body: JSON.stringify({
          dataCollectionId: COLLECTION_ID,
          dataItem: {
            data: {
              staffId,
              staffName: staffName || '',
              mood: mood || '',
              moodIndex: typeof moodIndex === 'number' ? moodIndex : null,
              note: note || '',
              lang: lang || 'ko',
              submittedAt: { $date: new Date().toISOString() }
            }
          }
        })
      });
      const data = await res.json();
      if (!res.ok) {
        return { statusCode: res.status, headers: CORS_HEADERS, body: JSON.stringify(data) };
      }
      return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ ok: true, item: data.dataItem }) };
    }

    if (event.httpMethod === 'GET') {
      const res = await fetch('https://www.wixapis.com/wix-data/v2/items/query', {
        method: 'POST',
        headers: wixHeaders,
        body: JSON.stringify({
          dataCollectionId: COLLECTION_ID,
          query: {
            sort: [{ fieldName: '_createdDate', order: 'DESC' }],
            paging: { limit: 100, offset: 0 }
          }
        })
      });
      const data = await res.json();
      if (!res.ok) {
        return { statusCode: res.status, headers: CORS_HEADERS, body: JSON.stringify(data) };
      }
      const items = (data.dataItems || []).map(function (d) { return d.data; });
      return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ ok: true, items }) };
    }

    return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) };
  } catch (err) {
    return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: String(err) }) };
  }
};
