# Водительский клиент

Точка входа: `/driver.html`

API:

- `POST /api/driver/login` `{ plate, pin }`
- `POST /api/driver/logout`
- `GET /api/driver/session`
- `GET /api/driver/home`
- `POST /api/driver/odometer` `{ tripId, odometerLoad1, odometerUnload1, ... }`
- `POST /api/driver/fuel` `{ tripId, amount, date, comment }`

Код машины хранится в поле `driverPin` у автомобиля (раздел «Парк»).
