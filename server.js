const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const webpush = require('web-push');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');

// ⚠️ СГЕНЕРИРУЙТЕ СВОИ КЛЮЧИ КОМАНДОЙ:
// npx web-push generate-vapid-keys
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

let subscriptions = [];

const server = http.createServer(app);
const io = socketIo(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

io.on('connection', (socket) => {
  console.log('✅ Клиент подключён:', socket.id);

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

  socket.on('disconnect', () => {
    console.log('❌ Клиент отключён:', socket.id);
  });
});

// Эндпоинты для push-подписок
app.post('/subscribe', (req, res) => {
  subscriptions.push(req.body);
  res.status(201).json({ message: 'Подписка сохранена' });
});

app.post('/unsubscribe', (req, res) => {
  const { endpoint } = req.body;
  subscriptions = subscriptions.filter(sub => sub.endpoint !== endpoint);
  res.status(200).json({ message: 'Подписка удалена' });
});

const PORT = 3001;
server.listen(PORT, () => {
  console.log(`🚀 Сервер: http://localhost:${PORT}`);
});