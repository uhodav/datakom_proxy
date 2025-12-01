# Rainbow SCADA Persistent Server (solution_5_server)

Node.js сервис для постоянного подключения к Rainbow SCADA с автоматическим восстановлением соединения и сохранением состояния в `state.json`.

## Установка и запуск


### 1. Перейти в папку сервиса
```bash
cd solution_5_server
```

### 2. Установить зависимости
```bash
npm install
```

### 3. Настроить параметры подключения
Отредактируйте файл `config.json` и укажите:
- `ws_url` — адрес WebSocket сервера
- `login` — логин пользователя
- `password` — пароль пользователя

### 4. Запустить сервис вручную
```bash
npm start
```

### 5. Остановить сервис (Ctrl+C)

### 6. Добавить сервис в автозапуск через pm2 (рекомендуется)
```bash
npm install -g pm2
pm2 start server.js --name rainbow-scada-server
pm2 save
pm2 startup
# После выполнения pm2 startup выполните команду, которую покажет pm2 (например, systemctl enable pm2-root)
```

### 7. Проверка состояния и логов
- Состояние соединения: файл `state.json` (ключ `connect_state`)
- Логи процесса через pm2:
```bash
pm2 logs rainbow-scada-server
```
- Остановить сервис:
```bash
pm2 stop rainbow-scada-server
```
- Перезапустить сервис:
```bash
pm2 restart rainbow-scada-server
```
- Удалить из pm2:
```bash
pm2 delete rainbow-scada-server
```

### 1. Перейти в папку сервиса
```bash
cd solution_5_server
```

### 2. Установить зависимости
```bash
npm install
```

### 3. Настроить параметры подключения
Отредактируйте файл `config.json` и укажите:
- `ws_url` — адрес WebSocket сервера
- `login` — логин пользователя
- `password` — пароль пользователя

### 4. Запустить сервис вручную
```bash
npm start
```

### 5. Остановить сервис (Ctrl+C)

### 6. Добавить сервис в автозапуск через pm2 (рекомендуется)
```bash
npm install -g pm2
pm2 start server.js --name rainbow-scada-server
pm2 save
pm2 startup
```

### 7. Проверка состояния и логов
- Состояние соединения: файл `state.json` (ключ `connect_state`)
- Логи процесса через pm2:
```bash
pm2 logs rainbow-scada-server
```
- Остановить сервис:
```bash
pm2 stop rainbow-scada-server
```
- Перезапустить сервис:
```bash
pm2 restart rainbow-scada-server
```
- Удалить из pm2:
```bash
pm2 delete rainbow-scada-server
```

---

**Примечание:**
- Для работы требуется Node.js >= 14.
- Все параметры подключения и логина — в `config.json`.
- Состояние соединения всегда актуально в `state.json`.
