// ==================== ПОДКЛЮЧЕНИЕ К СЕРВЕРУ ====================
const socket = io('http://localhost:3001');

// ==================== НАВИГАЦИЯ (APP SHELL) ====================
const contentDiv = document.getElementById('app-content');
const homeBtn = document.getElementById('home-btn');
const aboutBtn = document.getElementById('about-btn');

function setActive(activeId) {
  [homeBtn, aboutBtn].forEach(btn => btn.classList.remove('active'));
  document.getElementById(activeId).classList.add('active');
}

async function loadContent(page) {
  try {
    const res = await fetch(`/content/${page}.html`);
    contentDiv.innerHTML = await res.text();
    if (page === 'home') initNotes();
  } catch (err) {
    contentDiv.innerHTML = '<p class="is-center text-error">Ошибка загрузки страницы</p>';
    console.error(err);
  }
}

homeBtn.onclick = (e) => { 
  e.preventDefault(); 
  setActive('home-btn'); 
  loadContent('home'); 
};

aboutBtn.onclick = (e) => { 
  e.preventDefault(); 
  setActive('about-btn'); 
  loadContent('about'); 
};

// ==================== ЛОГИКА ЗАМЕТОК И НАПОМИНАНИЙ ====================
function initNotes() {
  const form = document.getElementById('note-form');
  const input = document.getElementById('note-input');
  const reminderForm = document.getElementById('reminder-form');
  const reminderText = document.getElementById('reminder-text');
  const reminderTime = document.getElementById('reminder-time');
  const list = document.getElementById('notes-list');

  function loadNotes() {
    const notes = JSON.parse(localStorage.getItem('notes') || '[]');
    list.innerHTML = notes.map(note => {
      let reminderInfo = '';
      if (note.reminder) {
        const date = new Date(note.reminder);
        reminderInfo = `<br><small>⏰ Напоминание: ${date.toLocaleString()}</small>`;
      }
      return `<li style="margin-bottom: 0.5rem; padding: 0.5rem; border-bottom: 1px solid #ddd;">
        📌 ${note.text}
        ${reminderInfo}
      </li>`;
    }).join('');
  }

  // Обычная заметка (без напоминания)
  if (form) {
    form.onsubmit = (e) => {
      e.preventDefault();
      const text = input.value.trim();
      if (text) {
        const notes = JSON.parse(localStorage.getItem('notes') || '[]');
        const newNote = { id: Date.now(), text, reminder: null };
        notes.push(newNote);
        localStorage.setItem('notes', JSON.stringify(notes));
        loadNotes();
        input.value = '';
        
        // Отправляем через WebSocket (как в 16-й работе)
        socket.emit('newTask', { text });
      }
    };
  }

  // Заметка с напоминанием
  if (reminderForm) {
    reminderForm.onsubmit = (e) => {
      e.preventDefault();
      const text = reminderText.value.trim();
      const timeValue = reminderTime.value;
      
      if (text && timeValue) {
        const reminderTimestamp = new Date(timeValue).getTime();
        const now = Date.now();
        
        if (reminderTimestamp <= now) {
          alert('⚠️ Дата и время должны быть в будущем!');
          return;
        }
        
        const notes = JSON.parse(localStorage.getItem('notes') || '[]');
        const newNote = { 
          id: Date.now(), 
          text: text, 
          reminder: reminderTimestamp 
        };
        notes.push(newNote);
        localStorage.setItem('notes', JSON.stringify(notes));
        loadNotes();
        
        // Отправляем на сервер для планирования уведомления
        socket.emit('newReminder', {
          id: newNote.id,
          text: text,
          reminderTime: reminderTimestamp
        });
        
        reminderText.value = '';
        reminderTime.value = '';
        
        alert(`✅ Напоминание установлено на ${new Date(reminderTimestamp).toLocaleString()}`);
      }
    };
  }

  loadNotes();
}

// ==================== WEBSOCKET: ПОЛУЧЕНИЕ СОБЫТИЙ ====================
socket.on('taskAdded', (task) => {
  console.log('📨 Задача от другого клиента:', task);
  
  // Показываем всплывающее сообщение
  const notification = document.createElement('div');
  notification.textContent = `✨ Новая заметка: ${task.text}`;
  notification.style.cssText = `
    position: fixed; 
    top: 10px; 
    right: 10px; 
    background: #4285f4; 
    color: white; 
    padding: 1rem; 
    border-radius: 5px; 
    z-index: 1000;
    animation: fadeOut 3s forwards;
  `;
  
  // Добавляем анимацию исчезновения
  const style = document.createElement('style');
  style.textContent = `
    @keyframes fadeOut {
      0% { opacity: 1; }
      70% { opacity: 1; }
      100% { opacity: 0; display: none; }
    }
  `;
  document.head.appendChild(style);
  
  document.body.appendChild(notification);
  setTimeout(() => notification.remove(), 3000);
});

// ==================== PUSH-УВЕДОМЛЕНИЯ ====================

// Вспомогательная функция: преобразование base64 в Uint8Array
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Подписка на push-уведомления
async function subscribeToPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('Push не поддерживается');
    return;
  }
  
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array('BAQlnFZCMjRbHkP0GJvwNkWhpNK1v2oaZaMCREquhzjfD5Sz7pn13Cpuv4BkzMAj-sEF3B4UZdQqU6YFIQPnXYc')
    });
    
    await fetch('http://localhost:3001/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(subscription)
    });
    
    console.log('✅ Подписка на push отправлена на сервер');
  } catch (err) {
    console.error('❌ Ошибка подписки на push:', err);
  }
}

// Отписка от push-уведомлений
async function unsubscribeFromPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('Push не поддерживается');
    return;
  }
  
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    
    if (subscription) {
      await fetch('http://localhost:3001/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: subscription.endpoint })
      });
      
      await subscription.unsubscribe();
      console.log('🔕 Отписка от push выполнена');
    }
  } catch (err) {
    console.error('❌ Ошибка отписки:', err);
  }
}

// ==================== ЗАГРУЗКА ГЛАВНОЙ СТРАНИЦЫ ====================
loadContent('home');

// ==================== РЕГИСТРАЦИЯ SERVICE WORKER И КНОПКИ PUSH ====================
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(async (reg) => {
        console.log('✅ Service Worker зарегистрирован:', reg.scope);
        
        // Находим кнопки
        const enableBtn = document.getElementById('enable-push');
        const disableBtn = document.getElementById('disable-push');
        
        if (enableBtn && disableBtn) {
          // Проверяем, есть ли уже активная подписка
          const subscription = await reg.pushManager.getSubscription();
          if (subscription) {
            enableBtn.style.display = 'none';
            disableBtn.style.display = 'inline-block';
          }
          
          // Кнопка "Включить уведомления"
          enableBtn.onclick = async () => {
            // Проверяем разрешение на уведомления
            if (Notification.permission === 'denied') {
              alert('Уведомления запрещены. Разрешите их в настройках браузера.');
              return;
            }
            
            if (Notification.permission === 'default') {
              const permission = await Notification.requestPermission();
              if (permission !== 'granted') {
                alert('Необходимо разрешить уведомления для работы push');
                return;
              }
            }
            
            await subscribeToPush();
            enableBtn.style.display = 'none';
            disableBtn.style.display = 'inline-block';
          };
          
          // Кнопка "Отключить уведомления"
          disableBtn.onclick = async () => {
            await unsubscribeFromPush();
            disableBtn.style.display = 'none';
            enableBtn.style.display = 'inline-block';
          };
        }
      })
      .catch(err => console.error('❌ Ошибка регистрации Service Worker:', err));
  });
}