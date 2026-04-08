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

// ==================== PUSH-УВЕДОМЛЕНИЯ (ДЛЯ 17-Й РАБОТЫ С КНОПКОЙ) ====================
self.addEventListener('push', (event) => {
  console.log('📨 Получено push-уведомление', event);
  
  let data = { 
    title: '🔔 Новое уведомление', 
    body: '',
    reminderId: null
  };
  
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
    vibrate: [200, 100, 200],
    data: { reminderId: data.reminderId }
  };
  
  // Добавляем кнопку "Отложить" ТОЛЬКО если это напоминание (есть reminderId)
  if (data.reminderId) {
    options.actions = [
      { action: 'snooze', title: '⏰ Отложить на 5 минут' }
    ];
    console.log('🔘 Добавлена кнопка "Отложить" для напоминания:', data.reminderId);
  }
  
  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// ==================== ОБРАБОТКА КЛИКА ПО УВЕДОМЛЕНИЮ (ДЛЯ 17-Й РАБОТЫ) ====================
self.addEventListener('notificationclick', (event) => {
  const notification = event.notification;
  const action = event.action;
  const reminderId = notification.data?.reminderId;
  
  console.log('🔔 Клик по уведомлению:', { action, reminderId });
  
  // Закрываем уведомление
  notification.close();
  
  // Если нажата кнопка "Отложить"
  if (action === 'snooze' && reminderId) {
    console.log('⏰ Откладываем напоминание:', reminderId);
    
    event.waitUntil(
      fetch(`/snooze?reminderId=${reminderId}`, { method: 'POST' })
        .then(response => {
          if (response.ok) {
            console.log('✅ Напоминание успешно отложено на 5 минут');
            
            // Показываем небольшое уведомление об откладывании
            return self.registration.showNotification('⏰ Напоминание отложено', {
              body: 'Новое напоминание придёт через 5 минут',
              icon: '/icons/favicon-128x128.png',
              badge: '/icons/favicon-48x48.png'
            });
          } else {
            console.error('❌ Ошибка откладывания');
          }
        })
        .catch(err => console.error('❌ Ошибка при откладывании:', err))
    );
  } else {
    // Обычный клик по уведомлению — открываем приложение
    console.log('🔓 Открываем приложение');
    
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
  }
});

// ==================== ОБРАБОТЧИК СООБЩЕНИЙ ОТ КЛИЕНТА ====================
self.addEventListener('message', (event) => {
  console.log('💬 Сообщение от клиента:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});