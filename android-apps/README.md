# APK Путевой (Android)

Готовые файлы:

- `apk/putevoy-driver.apk` — водитель (`com.putevoy.driver`)
- `apk/putevoy-manager.apk` — менеджер / админ (`com.putevoy.manager`)

## Установка на телефон

1. На компьютере в этой же Wi‑Fi сети: `npm run dev`
2. Узнайте IP компьютера (`ip a` / настройки сети), порт **5173**
3. Установите APK (разрешите установку из неизвестных источников)
4. При первом запуске введите адрес сервера, например: `http://192.168.0.15:5173`
5. Откроется:
   - водитель → `/driver.html`
   - менеджер → `/manager.html`

Назад в приложении возвращает к экрану смены сервера.

## Пересборка

Нужны Android SDK и JDK 17+.

```bash
export ANDROID_HOME=~/Android/Sdk
echo "sdk.dir=$ANDROID_HOME" > android-apps/driver/local.properties
echo "sdk.dir=$ANDROID_HOME" > android-apps/manager/local.properties
cd android-apps/driver && ./gradlew assembleDebug
cd ../manager && ./gradlew assembleDebug
cp driver/app/build/outputs/apk/debug/app-debug.apk dist/putevoy-driver.apk
cp manager/app/build/outputs/apk/debug/app-debug.apk dist/putevoy-manager.apk
```
