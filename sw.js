const CACHE = 'partflow-v4';
const FILES = ['./partflow-launcher.html', './partflow-final.html', './partflow-pilot.html', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', function(e){
  e.waitUntil(caches.open(CACHE).then(function(c){return c.addAll(FILES);}));
  self.skipWaiting();
});

self.addEventListener('activate', function(e){
  e.waitUntil(caches.keys().then(function(keys){
    return Promise.all(keys.filter(function(k){return k!==CACHE;}).map(function(k){return caches.delete(k);}));
  }));
  self.clients.claim();
});

self.addEventListener('fetch', function(e){
  // Netlify Functions(클라우드 데이터) 호출은 절대 캐시하지 않고 항상 네트워크로 직행
  if(e.request.url.indexOf('/.netlify/functions/') !== -1){
    e.respondWith(fetch(e.request));
    return;
  }
  // 그 외 페이지/정적 파일은 네트워크 우선, 실패하면 캐시 폴백 (오프라인 대비)
  e.respondWith(
    fetch(e.request).then(function(res){
      var resClone = res.clone();
      caches.open(CACHE).then(function(c){ c.put(e.request, resClone); });
      return res;
    }).catch(function(){
      return caches.match(e.request).then(function(cached){
        return cached || caches.match('./partflow-launcher.html');
      });
    })
  );
});
