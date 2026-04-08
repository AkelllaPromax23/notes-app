const STATIC_CACHE = 'app-shell-v2';
const DYNAMIC_CACHE = 'dynamic-v1';

const ASSETS = [
  '/',
  '/index.html',
  '/app.js',
  '/manifest.json'
];

// ==================== УСТАНОВКА ====================
self.addEventListener('install', event => {
  console.log('🔄 Service Worker устанавливается...');
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => {
        console.log('📦 Кэширование статических ресурсов');
        return cache.addAll(ASSETS);
      })
      .then(() => {
        console.log('✅ Статические ресурсы закэшированы');
        return self.skipWaiting();
      })
  );
});

// ==================== АКТИВАЦИЯ ====================
self.addEventListener('activate', event => {
  console.log('⚡ Service Worker активируется...');
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== STATIC_CACHE && key !== DYNAMIC_CACHE)
          .map(key => {
            console.log('🗑️ Удаляем старый кэш:', key);
            return caches.delete(key);
          })
      );
    }).then(() => {
      console.log('✅ Service Worker активирован и готов');
      return self.clients.claim();
    })
  );
});

// ==================== ПЕРЕХВАТ ЗАПРОСОВ ====================
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // Пропускаем запросы к другим источникам (например, к CDN chota)
  if (url.origin !== location.origin) return;

  // Динамические страницы (content/*) – стратегия: сначала сеть, затем кэш
  if (url.pathname.startsWith('/content/')) {
    event.respondWith(
      fetch(event.request)
        .then(networkRes => {
          // Кэшируем свежий ответ
          const resClone = networkRes.clone();
          caches.open(DYNAMIC_CACHE).then(cache => {
            cache.put(event.request, resClone);
          });
          return networkRes;
        })
        .catch(() => {
          // Если сеть недоступна, берём из кэша
          return caches.match(event.request)
            .then(cached => {
              if (cached) return cached;
              // Если нет в кэше, показываем заглушку
              return new Response('Страница недоступна офлайн', {
                status: 404,
                statusText: 'Not Found'
              });
            });
        })
    );
    return;
  }

  // Для статических ресурсов – стратегия: сначала кэш, затем сеть
  event.respondWith(
    caches.match(event.request)
      .then(cachedRes => {
        return cachedRes || fetch(event.request).catch(() => {
          // Если запрос не найден в кэше и сеть недоступна
          if (event.request.mode === 'navigate') {
            return caches.match('/index.html');
          }
          return new Response('Ресурс недоступен офлайн', {
            status: 404,
            statusText: 'Not Found'
          });
        });
      })
  );
});

// ==================== PUSH-УВЕДОМЛЕНИЯ ====================
self.addEventListener('push', (event) => {
  console.log('📨 Получено push-уведомление', event);
  
  let data = { 
    title: '🔔 Новое уведомление', 
    body: 'У вас новое сообщение' 
  };
  
  // Парсим данные из push-уведомления
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data.body = event.data.text();
    }
  }
  
  const options = {
    body: data.body,
    icon: '/icons/favicon-128x128.png',
    badge: '/icons/favicon-48x48.png',
    vibrate: [200, 100, 200], // Вибрация на поддерживаемых устройствах
    tag: 'notification-' + Date.now(), // Чтобы не дублировались
    data: {
      url: '/' // URL для перехода при клике
    }
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// ==================== ОБРАБОТЧИК КЛИКА ПО УВЕДОМЛЕНИЮ ====================
self.addEventListener('notificationclick', (event) => {
  console.log('🔔 Пользователь кликнул по уведомлению', event);
  
  event.notification.close();
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(windowClients => {
        // Если уже есть открытое окно, переключаемся на него
        for (let client of windowClients) {
          if (client.url === '/' && 'focus' in client) {
            return client.focus();
          }
        }
        // Иначе открываем новое окно
        if (clients.openWindow) {
          return clients.openWindow('/');
        }
      })
  );
});

// ==================== ОБРАБОТЧИК СООБЩЕНИЙ ОТ КЛИЕНТА ====================
self.addEventListener('message', (event) => {
  console.log('💬 Сообщение от клиента:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});