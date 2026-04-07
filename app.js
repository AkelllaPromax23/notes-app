// ========== Работа с заметками (localStorage) ==========
const form = document.getElementById('note-form');
const input = document.getElementById('note-input');
const list = document.getElementById('notes-list');

// Загрузка заметок
function loadNotes() {
  const notes = JSON.parse(localStorage.getItem('notes') || '[]');
  list.innerHTML = notes.map(note => `<li>📌 ${escapeHtml(note)}</li>`).join('');
}

// Сохранение новой заметки
function addNote(text) {
  const notes = JSON.parse(localStorage.getItem('notes') || '[]');
  notes.push(text);
  localStorage.setItem('notes', JSON.stringify(notes));
  loadNotes();
}

// Простая защита от XSS
function escapeHtml(str) {
  return str.replace(/[&<>]/g, function(m) {
    if (m === '&') return '&amp;';
    if (m === '<') return '&lt;';
    if (m === '>') return '&gt;';
    return m;
  });
}

// Обработчик формы
form.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (text) {
    addNote(text);
    input.value = '';
  }
});

// Инициализация
loadNotes();

// ========== Регистрация Service Worker ==========
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      console.log('✅ Service Worker зарегистрирован, область:', registration.scope);
    } catch (err) {
      console.error('❌ Ошибка регистрации Service Worker:', err);
    }
  });
} else {
  console.warn('⚠️ Service Worker не поддерживается браузером');
}