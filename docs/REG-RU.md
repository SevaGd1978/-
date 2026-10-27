# Развёртывание «Путевой» на REG.RU (VPS)

Нужен **VPS/VDS** с Ubuntu 22.04+ (не только виртуальный хостинг): Node 22, постоянный диск для SQLite.

## 1. Сервер

- Заказать VPS в REG.RU или использовать существующий.
- Открыть порты **22** (SSH) и **80/443** (сайт).
- Подключиться: `ssh root@<IP>`.

## 2. Docker (рекомендуется)

```bash
apt-get update && apt-get install -y docker.io docker-compose-plugin
mkdir -p /opt/putevoy/data
```

Скопировать на сервер репозиторий (или образ) и файл базы **`putevoy.sqlite`** в `/opt/putevoy/data/`.

```bash
cd /opt/putevoy
docker build -t putevoy .
docker run -d --name putevoy --restart unless-stopped \
  -p 3000:3000 \
  -v /opt/putevoy/data:/data \
  putevoy
```

Перед nginx/Caddy: приложение слушает **3000**, база — **`/data/putevoy.sqlite`**.

## 3. Без Docker

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs git
git clone <repo> /opt/putevoy/app
cd /opt/putevoy/app && npm ci --include=dev && npm run build
mkdir -p /data
# положить putevoy.sqlite в /data/
PUTEVOY_DB=/data/putevoy.sqlite PORT=3000 node --experimental-sqlite --experimental-strip-types server/index.ts
```

Systemd unit: `Environment=PUTEVOY_DB=/data/putevoy.sqlite`, `WorkingDirectory=/opt/putevoy/app`.

## 4. Домен REG.RU

A-запись на IP VPS → reverse proxy (nginx) на `127.0.0.1:3000`, TLS через certbot.

## 5. Данные с Amvera

- Войти в приложение под администратором и скачать базу: **GET `/api/backup`** (нужно право «Учётные записи»). Перед отдачей файла сервер делает `wal_checkpoint`.
- Либо скачать папку **Data** в кабинете Amvera (Репозиторий → Data) или `amvera download data --slug putevoy --region msk_1` (если в архиве только пустой файл — сначала перезапустите приложение на Amvera).
- Не публиковать `.sqlite` в открытый GitHub.

Amvera-прод оставить работать, пока не проверите копию на REG.RU.
