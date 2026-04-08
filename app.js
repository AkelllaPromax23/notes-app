// Навигация
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
    contentDiv.innerHTML = '<p>Ошибка загрузки</p>';
  }
}

homeBtn.onclick = (e) => { e.preventDefault(); setActive('home-btn'); loadContent('home'); };
aboutBtn.onclick = (e) => { e.preventDefault(); setActive('about-btn'); loadContent('about'); };

// Логика заметок
function initNotes() {
  const form = document.getElementById('note-form');
  const input = document.getElementById('note-input');
  const list = document.getElementById('notes-list');
  if (!form) return;

  function loadNotes() {
    const notes = JSON.parse(localStorage.getItem('notes') || '[]');
    list.innerHTML = notes.map(n => `<li>📌 ${n}</li>`).join('');
  }

  form.onsubmit = (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (text) {
      const notes = JSON.parse(localStorage.getItem('notes') || '[]');
      notes.push(text);
      localStorage.setItem('notes', JSON.stringify(notes));
      loadNotes();
      input.value = '';
    }
  };
  loadNotes();
}

// Загрузка главной страницы
loadContent('home');

// Регистрация SW
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => console.log('SW зарегистрирован:', reg.scope))
      .catch(err => console.error('Ошибка SW:', err));
  });
}