const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const webpush = require('web-push');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');

// ⚠️ ВСТАВЬТЕ ВАШИ КЛЮЧИ (те же, что и в 16-й работе)
const vapidKeys = {
  publicKey: 'BAQlnFZCMjRbHkP0GJvwNkWhpNK1v2oaZaMCREquhzjfD5Sz7pn13Cpuv4BkzMAj-sEF3B4UZdQqU6YFIQPnXYc',
  privateKey: 'OWu7jCOBQdwyaMB1ovofRuVqspUv2OSisRUZMnFRqug'
};

webpush.setVapidDetails(
  'mailto:your-email@example.com',
  vapidKeys.publicKey,
  vapidKeys.privateKey
);

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, './')));

// Хранилище push-подписок
let subscriptions = [];

// ==================== НОВОЕ ДЛЯ 17-Й РАБОТЫ ====================
// Хранилище активных напоминаний (таймеров)
const reminders = new Map();
// =============================================================

const server = http.createServer(app);
const io = socketIo(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

io.on('connection', (socket) => {
  console.log('✅ Клиент подключён:', socket.id);

  // ==================== ОБЫЧНАЯ ЗАМЕТКА (из 16-й работы) ====================
  socket.on('newTask', (task) => {
    console.log('📌 Новая задача от клиента:', task);
    
    // Рассылаем всем клиентам
    io.emit('taskAdded', task);

    // Push-уведомление всем подписанным
    const payload = JSON.stringify({
      title: '📝 Новая заметка',
      body: task.text
    });

    subscriptions.forEach(sub => {
      webpush.sendNotification(sub, payload).catch(err => {
        console.error('❌ Ошибка push:', err);
      });
    });
  });

  // ==================== НОВОЕ ДЛЯ 17-Й РАБОТЫ: НАПОМИНАНИЕ ====================
  socket.on('newReminder', (reminder) => {
    const { id, text, reminderTime } = reminder;
    const delay = reminderTime - Date.now();
    
    console.log(`⏰ Новое напоминание: "${text}" через ${Math.round(delay / 1000)} секунд (${Math.round(delay / 60000)} мин)`);
    
    if (delay <= 0) {
      console.log('❌ Время напоминания уже прошло');
      return;
    }

    // Сохраняем таймер
    const timeoutId = setTimeout(() => {
      console.log(`🔔 ОТПРАВЛЯЕМ НАПОМИНАНИЕ: "${text}"`);
      
      const payload = JSON.stringify({
        title: '⏰ НАПОМИНАНИЕ',
        body: text,
        reminderId: id
      });

      subscriptions.forEach(sub => {
        webpush.sendNotification(sub, payload).catch(err => {
          console.error('❌ Ошибка push:', err);
        });
      });

      // Удаляем напоминание из хранилища после отправки
      reminders.delete(id);
    }, delay);

    reminders.set(id, { 
      timeoutId, 
      text, 
      reminderTime 
    });
    
    console.log(`✅ Напоминание запланировано. Активных напоминаний: ${reminders.size}`);
  });
  // ===========================================================================

  socket.on('disconnect', () => {
    console.log('❌ Клиент отключён:', socket.id);
  });
});

// ==================== ЭНДПОИНТЫ ДЛЯ PUSH-ПОДПИСОК ====================
app.post('/subscribe', (req, res) => {
  subscriptions.push(req.body);
  console.log(`📝 Новая подписка. Всего: ${subscriptions.length}`);
  res.status(201).json({ message: 'Подписка сохранена' });
});

app.post('/unsubscribe', (req, res) => {
  const { endpoint } = req.body;
  subscriptions = subscriptions.filter(sub => sub.endpoint !== endpoint);
  console.log(`🔕 Отписка. Осталось: ${subscriptions.length}`);
  res.status(200).json({ message: 'Подписка удалена' });
});

// ==================== НОВОЕ ДЛЯ 17-Й РАБОТЫ: ОТЛОЖИТЬ НАПОМИНАНИЕ ====================
app.post('/snooze', (req, res) => {
  const reminderId = parseInt(req.query.reminderId, 10);
  
  console.log(`⏰ Запрос на откладывание напоминания ${reminderId}`);
  
  if (!reminderId || !reminders.has(reminderId)) {
    console.log(`❌ Напоминание ${reminderId} не найдено`);
    return res.status(400).json({ error: 'Reminder not found' });
  }

  const reminder = reminders.get(reminderId);
  
  // Отменяем предыдущий таймер
  clearTimeout(reminder.timeoutId);

  // Устанавливаем новый через 5 минут (300 000 мс)
  const snoozeDelay = 5 * 60 * 1000;
  const newTimeoutId = setTimeout(() => {
    console.log(`🔔 ОТЛОЖЕННОЕ НАПОМИНАНИЕ: "${reminder.text}"`);
    
    const payload = JSON.stringify({
      title: '⏰ Отложенное напоминание',
      body: reminder.text,
      reminderId: reminderId
    });

    subscriptions.forEach(sub => {
      webpush.sendNotification(sub, payload).catch(err => {
        console.error('❌ Ошибка push:', err);
      });
    });

    reminders.delete(reminderId);
    console.log(`🗑️ Напоминание ${reminderId} удалено после отправки`);
  }, snoozeDelay);

  // Обновляем хранилище
  reminders.set(reminderId, {
    timeoutId: newTimeoutId,
    text: reminder.text,
    reminderTime: Date.now() + snoozeDelay
  });

  console.log(`⏰ Напоминание "${reminder.text}" отложено на 5 минут`);
  console.log(`📊 Активных напоминаний: ${reminders.size}`);
  
  res.status(200).json({ message: 'Reminder snoozed for 5 minutes' });
});
// ====================================================================================

const PORT = 3001;
server.listen(PORT, () => {
  console.log(`🚀 Сервер запущен на http://localhost:${PORT}`);
  console.log(`📊 VAPID публичный ключ: ${vapidKeys.publicKey.substring(0, 30)}...`);
});