# Путевой — приложение водителя (Android)

Мобильный клиент — отдельная страница `driver.html`:

1. Вход по **госномеру** и **коду машины** (задаётся диспетчером в «Парк»).
2. Список рейсов этой машины.
3. Ввод **одометра** на погрузках/выгрузках.
4. Запись **чеков на соляру** (сумма с АЗС).

## Локально в браузере (без Amvera)

```bash
npm run dev
```

Откройте: http://localhost:5173/driver.html

Демо-код для машин из демо-данных: `1234`  
Пример номера: `А123ВС 116`

На телефоне в той же сети: `http://<IP-этого-компа>:5173/driver.html`

Можно «Установить приложение» из Chrome (PWA / Add to Home Screen).

## Сборка APK через Capacitor

На машине с Android SDK / Android Studio:

```bash
npm run build
npx --yes @capacitor/cli@6 create android-driver-app com.putevoy.driver "Putevoy Driver" --web-dir=dist
# скопируйте содержимое dist и укажите server.url на ваш локальный/боевой сервер
cd android-driver-app
npx cap add android
npx cap open android
```

В `capacitor.config.json` для работы с вашим сервером:

```json
{
  "appId": "com.putevoy.driver",
  "appName": "Putevoy Driver",
  "webDir": "dist",
  "server": {
    "url": "http://192.168.x.x:5173/driver.html",
    "cleartext": true
  }
}
```

Пока на Amvera ничего не выкладываем — только локальная проверка.
