const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// Serve static frontend files if built
const distPath = path.join(__dirname, '..', 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
}

// Load loading norms data
const loadingNormsData = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'data', 'loadingNormsData.json'), 'utf-8')
);

// In-memory initial mock data
let cargos = [
  {
    id: 'c-101',
    fromLocation: 'Москва',
    toLocation: 'Санкт-Петербург',
    cargoName: 'Оборудование и запчасти',
    weightTons: 20,
    volumeM3: 86,
    bodyType: 'Тент / Штора',
    loadingType: 'Верхняя / Задняя',
    loadDate: '2026-09-08',
    rateRub: 85000,
    paymentType: 'Б/Н с НДС',
    shipperName: 'ООО "Логистик Групп"',
    shipperInn: '7701234567',
    contactPhone: '+7 (495) 123-45-67',
    atiRating: 4.8,
    status: 'Активно',
    createdAt: new Date().toISOString()
  },
  {
    id: 'c-102',
    fromLocation: 'Екатеринбург',
    toLocation: 'Казань',
    cargoName: 'Трубы стальные в ППУ изоляции',
    weightTons: 15,
    volumeM3: 90,
    bodyType: 'Открытый бортовой',
    loadingType: 'Верхняя (кран)',
    loadDate: '2026-09-09',
    rateRub: 110000,
    paymentType: 'Б/Н без НДС',
    shipperName: 'ЗАО "УралТрубПром"',
    shipperInn: '6671987654',
    contactPhone: '+7 (343) 987-65-43',
    atiRating: 4.9,
    status: 'Активно',
    createdAt: new Date().toISOString()
  },
  {
    id: 'c-103',
    fromLocation: 'Краснодар',
    toLocation: 'Москва',
    cargoName: 'Продукты питания (Реф)',
    weightTons: 18,
    volumeM3: 82,
    bodyType: 'Рефрижератор (+2..+4°C)',
    loadingType: 'Задняя',
    loadDate: '2026-09-10',
    rateRub: 145000,
    paymentType: 'Б/Н с НДС',
    shipperName: 'ИП "АгроЮг Перевозки"',
    shipperInn: '2310054321',
    contactPhone: '+7 (861) 555-01-22',
    atiRating: 4.6,
    status: 'В работе',
    createdAt: new Date().toISOString()
  },
  {
    id: 'c-104',
    fromLocation: 'Нижний Новгород',
    toLocation: 'Новосибирск',
    cargoName: 'Металлоконструкции и фасонка',
    weightTons: 21.5,
    volumeM3: 75,
    bodyType: 'Шаланда / Открытый',
    loadingType: 'Верхняя',
    loadDate: '2026-09-08',
    rateRub: 230000,
    paymentType: 'Б/Н с НДС',
    shipperName: 'ООО "ВолгаСталь"',
    shipperInn: '5260112233',
    contactPhone: '+7 (831) 444-33-22',
    atiRating: 5.0,
    status: 'Активно',
    createdAt: new Date().toISOString()
  }
];

let transports = [
  {
    id: 't-201',
    currentLocation: 'Москва',
    destinationLocation: 'Любое направление',
    truckType: 'Еврофура (Тент 92м³)',
    maxCapacityTons: 20,
    maxVolumeM3: 92,
    carrierName: 'ООO "Магистраль Транс"',
    carrierInn: '7722445566',
    driverName: 'Иванов Петр Сергеевич',
    driverPhone: '+7 (916) 111-22-33',
    truckRegNumber: 'А 777 АА 777',
    atiRating: 4.9,
    readyDate: '2026-09-08',
    ratePerKmRub: 90
  },
  {
    id: 't-202',
    currentLocation: 'Санкт-Петербург',
    destinationLocation: 'Москва / ЦФО',
    truckType: 'Рефрижератор 86м³',
    maxCapacityTons: 20,
    maxVolumeM3: 86,
    carrierName: 'ИП Смирнов А.В.',
    carrierInn: '7810998877',
    driverName: 'Смирнов Алексей Владимирович',
    driverPhone: '+7 (921) 999-88-77',
    truckRegNumber: 'В 123 ОО 178',
    atiRating: 4.7,
    readyDate: '2026-09-08',
    ratePerKmRub: 105
  },
  {
    id: 't-203',
    currentLocation: 'Казань',
    destinationLocation: 'Екатеринбург / Урал',
    truckType: 'Бортовой 13.6м (Шаланда)',
    maxCapacityTons: 22,
    maxVolumeM3: 80,
    carrierName: 'ООО "КазаньСпецТранс"',
    carrierInn: '1655332211',
    driverName: 'Хабибуллин Руслан Равилевич',
    driverPhone: '+7 (987) 222-33-44',
    truckRegNumber: 'Е 456 КХ 116',
    atiRating: 4.8,
    readyDate: '2026-09-09',
    ratePerKmRub: 95
  }
];

let counterparties = [
  {
    inn: '7701234567',
    name: 'ООО "Логистик Групп"',
    ogrn: '1157746123456',
    director: 'Соколов Дмитрий Николаевич',
    atiScore: 4.8,
    atiColor: 'green',
    yearsInAti: 7,
    claimsCount: 0,
    unpaidCount: 0,
    recommendationsCount: 34,
    status: 'Проверен ATI Паспорт',
    verifiedAddress: 'г. Москва, ул. Ленинградский проспект, д. 39'
  },
  {
    inn: '6671987654',
    name: 'ЗАО "УралТрубПром"',
    ogrn: '1026605234890',
    director: 'Морозов Андрей Викторович',
    atiScore: 4.9,
    atiColor: 'green',
    yearsInAti: 11,
    claimsCount: 0,
    unpaidCount: 0,
    recommendationsCount: 89,
    status: 'Надежный грузоотправитель',
    verifiedAddress: 'г. Екатеринбург, ул. Машиностроителей, д. 19'
  },
  {
    inn: '7722445566',
    name: 'ООО "Магистраль Транс"',
    ogrn: '1187746889900',
    director: 'Иванов Сергей Васильевич',
    atiScore: 4.9,
    atiColor: 'green',
    yearsInAti: 5,
    claimsCount: 1,
    unpaidCount: 0,
    recommendationsCount: 52,
    status: 'Проверен ATI Паспорт',
    verifiedAddress: 'г. Москва, ул. Рязанский проспект, д. 22'
  },
  {
    inn: '9900112233',
    name: 'ООО "Сомнительный Перевозчик"',
    ogrn: '1217700998877',
    director: 'Петров И.И.',
    atiScore: 2.1,
    atiColor: 'red',
    yearsInAti: 1,
    claimsCount: 5,
    unpaidCount: 3,
    recommendationsCount: 1,
    status: 'Высокий риск / Претензии в ATI',
    verifiedAddress: 'г. Химки, ул. Рабочая, д. 2'
  }
];

let orders = [
  {
    id: 'ORD-2026-001',
    cargoId: 'c-101',
    orderDate: '2026-09-07',
    shipperName: 'ООО "Логистик Групп"',
    shipperInn: '7701234567',
    carrierName: 'ООО "Магистраль Транс"',
    carrierInn: '7722445566',
    driverName: 'Иванов Петр Сергеевич',
    driverPassport: '4510 № 889900 выдан ГУ МВД г. Москвы',
    truckRegNumber: 'А 777 АА 777 / прицеп ВТ 1234 77',
    routeFrom: 'г. Москва, склад Южный порт',
    routeTo: 'г. Санкт-Петербург, промзона Парнас',
    cargoName: 'Оборудование и запчасти (20т / 86м³)',
    rateShipperRub: 85000,
    rateCarrierRub: 75000,
    expeditorMarginRub: 10000,
    paymentTerms: 'Оплата в течение 5 банковских дней по сканам ТТН/УПД',
    status: 'Подписан'
  }
];

// Distance matrix between key cities (km)
const cityDistances = {
  'Москва': {
    'Москва': 0, 'Санкт-Петербург': 710, 'Екатеринбург': 1790, 'Новосибирск': 3350,
    'Казань': 820, 'Нижний Новгород': 420, 'Краснодар': 1350, 'Самара': 1060,
    'Челябинск': 1780, 'Ростов-на-Дону': 1070, 'Уфа': 1350, 'Воронеж': 520, 'Тюмень': 2100
  },
  'Санкт-Петербург': {
    'Москва': 710, 'Санкт-Петербург': 0, 'Екатеринбург': 2300, 'Новосибирск': 3900,
    'Казань': 1520, 'Нижний Новгород': 1120, 'Краснодар': 2060, 'Самара': 1770,
    'Ростов-на-Дону': 1780, 'Уфа': 2050
  },
  'Екатеринбург': {
    'Москва': 1790, 'Санкт-Петербург': 2300, 'Екатеринбург': 0, 'Новосибирск': 1600,
    'Казань': 970, 'Нижний Новгород': 1380, 'Челябинск': 210, 'Тюмень': 320, 'Уфа': 520
  },
  'Казань': {
    'Москва': 820, 'Санкт-Петербург': 1520, 'Екатеринбург': 970, 'Новосибирск': 2520,
    'Казань': 0, 'Нижний Новгород': 390, 'Самара': 360, 'Уфа': 530, 'Краснодар': 1620
  },
  'Нижний Новгород': {
    'Москва': 420, 'Санкт-Петербург': 1120, 'Екатеринбург': 1380, 'Новосибирск': 2950,
    'Казань': 390, 'Нижний Новгород': 0, 'Самара': 700, 'Краснодар': 1530
  },
  'Краснодар': {
    'Москва': 1350, 'Санкт-Петербург': 2060, 'Екатеринбург': 2450, 'Казань': 1620,
    'Краснодар': 0, 'Ростов-на-Дону': 280, 'Воронеж': 830
  },
  'Новосибирск': {
    'Москва': 3350, 'Санкт-Петербург': 3900, 'Екатеринбург': 1600, 'Казань': 2520,
    'Новосибирск': 0, 'Челябинск': 1580, 'Тюмень': 1280, 'Омск': 650
  }
};

// --- API ENDPOINTS ---

// Cargos
app.get('/api/cargos', (req, res) => {
  const { from, to, bodyType, minWeight, maxWeight } = req.query;
  let filtered = [...cargos];

  if (from) {
    filtered = filtered.filter(c => c.fromLocation.toLowerCase().includes(from.toLowerCase()));
  }
  if (to) {
    filtered = filtered.filter(c => c.toLocation.toLowerCase().includes(to.toLowerCase()));
  }
  if (bodyType && bodyType !== 'Все') {
    filtered = filtered.filter(c => c.bodyType.toLowerCase().includes(bodyType.toLowerCase()));
  }
  if (minWeight) {
    filtered = filtered.filter(c => c.weightTons >= parseFloat(minWeight));
  }
  if (maxWeight) {
    filtered = filtered.filter(c => c.weightTons <= parseFloat(maxWeight));
  }

  res.json({ success: true, count: filtered.length, data: filtered });
});

app.post('/api/cargos', (req, res) => {
  const newCargo = {
    id: `c-${Date.now().toString().slice(-4)}`,
    fromLocation: req.body.fromLocation || 'Москва',
    toLocation: req.body.toLocation || 'Санкт-Петербург',
    cargoName: req.body.cargoName || 'Груз общего назначения',
    weightTons: parseFloat(req.body.weightTons) || 20,
    volumeM3: parseFloat(req.body.volumeM3) || 86,
    bodyType: req.body.bodyType || 'Тент',
    loadingType: req.body.loadingType || 'Верхняя / Задняя',
    loadDate: req.body.loadDate || new Date().toISOString().split('T')[0],
    rateRub: parseFloat(req.body.rateRub) || 50000,
    paymentType: req.body.paymentType || 'Б/Н с НДС',
    shipperName: req.body.shipperName || 'ООО Экспедиция',
    shipperInn: req.body.shipperInn || '7700000000',
    contactPhone: req.body.contactPhone || '+7 (800) 000-00-00',
    atiRating: 5.0,
    status: 'Активно',
    createdAt: new Date().toISOString()
  };
  cargos.unshift(newCargo);
  res.status(201).json({ success: true, data: newCargo });
});

app.delete('/api/cargos/:id', (req, res) => {
  const { id } = req.params;
  cargos = cargos.filter(c => c.id !== id);
  res.json({ success: true, message: `Cargo ${id} removed` });
});

// Transports
app.get('/api/transports', (req, res) => {
  const { current, destination, truckType } = req.query;
  let filtered = [...transports];

  if (current) {
    filtered = filtered.filter(t => t.currentLocation.toLowerCase().includes(current.toLowerCase()));
  }
  if (destination) {
    filtered = filtered.filter(t => t.destinationLocation.toLowerCase().includes(destination.toLowerCase()));
  }
  if (truckType && truckType !== 'Все') {
    filtered = filtered.filter(t => t.truckType.toLowerCase().includes(truckType.toLowerCase()));
  }

  res.json({ success: true, count: filtered.length, data: filtered });
});

app.post('/api/transports', (req, res) => {
  const newTransport = {
    id: `t-${Date.now().toString().slice(-4)}`,
    currentLocation: req.body.currentLocation || 'Москва',
    destinationLocation: req.body.destinationLocation || 'Любое направление',
    truckType: req.body.truckType || 'Еврофура (Тент)',
    maxCapacityTons: parseFloat(req.body.maxCapacityTons) || 20,
    maxVolumeM3: parseFloat(req.body.maxVolumeM3) || 86,
    carrierName: req.body.carrierName || 'ООО "АвтоТранс"',
    carrierInn: req.body.carrierInn || '7711223344',
    driverName: req.body.driverName || 'Сидоров И.И.',
    driverPhone: req.body.driverPhone || '+7 (900) 123-45-67',
    truckRegNumber: req.body.truckRegNumber || 'Х 999 ХХ 777',
    atiRating: 4.8,
    readyDate: req.body.readyDate || new Date().toISOString().split('T')[0],
    ratePerKmRub: parseFloat(req.body.ratePerKmRub) || 90
  };
  transports.unshift(newTransport);
  res.status(201).json({ success: true, data: newTransport });
});

app.delete('/api/transports/:id', (req, res) => {
  const { id } = req.params;
  transports = transports.filter(t => t.id !== id);
  res.json({ success: true, message: `Transport ${id} removed` });
});

// Route & Freight Cost Calculator
app.post('/api/route-calc', (req, res) => {
  const { fromCity, toCity, truckWeightTons = 20, expeditorCommissionPercent = 10 } = req.body;

  let distanceKm = 0;
  if (cityDistances[fromCity] && cityDistances[fromCity][toCity]) {
    distanceKm = cityDistances[fromCity][toCity];
  } else if (cityDistances[toCity] && cityDistances[toCity][fromCity]) {
    distanceKm = cityDistances[toCity][fromCity];
  } else {
    distanceKm = 1150;
  }

  const drivingHours = (distanceKm / 65).toFixed(1);
  const daysInTransit = Math.ceil(drivingHours / 9);

  const fuelLiters = Math.round((distanceKm / 100) * 32);
  const fuelCostRub = Math.round(fuelLiters * 68);

  let ratePerKm = 95;
  if (truckWeightTons <= 1.5) ratePerKm = 35;
  else if (truckWeightTons <= 5) ratePerKm = 55;
  else if (truckWeightTons <= 10) ratePerKm = 75;

  const baseCarrierRate = Math.round(distanceKm * ratePerKm);
  const expeditorMarginRub = Math.round((baseCarrierRate * expeditorCommissionPercent) / 100);
  const recommendedShipperRate = baseCarrierRate + expeditorMarginRub;

  res.json({
    success: true,
    fromCity,
    toCity,
    distanceKm,
    drivingHours: parseFloat(drivingHours),
    daysInTransit,
    fuelConsumption: {
      liters: fuelLiters,
      costRub: fuelCostRub,
      fuelPricePerLiter: 68
    },
    freightCalculation: {
      carrierRateRub: baseCarrierRate,
      expeditorMarginRub,
      expeditorMarginPercent: expeditorCommissionPercent,
      shipperRateRub: recommendedShipperRate,
      recommendedShipperRate: recommendedShipperRate,
      ratePerKmRub: ratePerKm
    }
  });
});

// Pipe & Fitting Loading Norms
app.get('/api/loading-norms/fittings', (req, res) => {
  res.json({ success: true, data: loadingNormsData.fittings });
});

app.get('/api/loading-norms/pipes', (req, res) => {
  res.json({ success: true, data: loadingNormsData.pipes });
});

app.post('/api/loading-norms/calculate', (req, res) => {
  const { productType, shellDiameter, stakeHeight, pipeCount } = req.body;

  if (productType === 'pipe') {
    const pipeRow = loadingNormsData.pipes.find(
      p => (p.shell_diameter || p.shellDiameter) === String(shellDiameter)
    );
    if (!pipeRow) {
      return res.status(404).json({ success: false, message: 'Диаметр оболочки не найден в таблице норм' });
    }

    let normPerTruck = pipeRow.h2_0;
    if (stakeHeight === '1.8' || stakeHeight === '1,8') normPerTruck = pipeRow.h1_8;
    else if (stakeHeight === '2.2' || stakeHeight === '2,2') normPerTruck = pipeRow.h2_2;

    const requestedCount = parseInt(pipeCount) || normPerTruck;
    const requiredTrucks = Math.ceil(requestedCount / normPerTruck);

    return res.json({
      success: true,
      productType: 'Труба в ППУ изоляции',
      shellDiameter,
      stakeHeight: stakeHeight || '2.0 метра',
      normPerTruck,
      requestedCount,
      requiredTrucks,
      loadingEfficiencyPercent: Math.round((requestedCount / (requiredTrucks * normPerTruck)) * 100)
    });
  } else {
    const fittingRow = loadingNormsData.fittings.find(
      f => (f.shell_diameter || f.shellDiameter) === String(shellDiameter)
    );
    return res.json({
      success: true,
      productType: 'Фасонные изделия (Отводы, НОП, Концевые элементы)',
      shellDiameter,
      normsOneEndTruck: fittingRow || { bends: '30-50', nop: '15-25', end_element: '5-10' },
      notes: '*Расчет приведен для 1 конца еврофуры. Для всей фуры (2 конца) умножайте на 2.'
    });
  }
});

// Counterparty verification
app.get('/api/counterparties', (req, res) => {
  const { query } = req.query;
  if (!query) {
    return res.json({ success: true, data: counterparties });
  }
  const filtered = counterparties.filter(
    cp => cp.inn.includes(query) || cp.name.toLowerCase().includes(query.toLowerCase())
  );
  res.json({ success: true, data: filtered });
});

// Orders (Договор-Заявка)
app.get('/api/orders', (req, res) => {
  res.json({ success: true, count: orders.length, data: orders });
});

app.post('/api/orders', (req, res) => {
  const newOrder = {
    id: `ORD-2026-${(orders.length + 1).toString().padStart(3, '0')}`,
    cargoId: req.body.cargoId || 'c-custom',
    orderDate: new Date().toISOString().split('T')[0],
    shipperName: req.body.shipperName || 'ООО Грузоотправитель',
    shipperInn: req.body.shipperInn || '7700000000',
    carrierName: req.body.carrierName || 'ООО АвтоПеревозчик',
    carrierInn: req.body.carrierInn || '7711111111',
    driverName: req.body.driverName || 'Иванов И.И.',
    driverPassport: req.body.driverPassport || '4500 № 123456',
    truckRegNumber: req.body.truckRegNumber || 'А 111 АА 777',
    routeFrom: req.body.routeFrom || 'Москва',
    routeTo: req.body.routeTo || 'Санкт-Петербург',
    cargoName: req.body.cargoName || 'Груз 20т',
    rateShipperRub: parseFloat(req.body.rateShipperRub) || 90000,
    rateCarrierRub: parseFloat(req.body.rateCarrierRub) || 80000,
    expeditorMarginRub: (parseFloat(req.body.rateShipperRub) || 90000) - (parseFloat(req.body.rateCarrierRub) || 80000),
    paymentTerms: req.body.paymentTerms || 'Оплата по оригиналу ТТН 5 дней',
    status: 'Сформирован'
  };

  orders.unshift(newOrder);
  res.status(201).json({ success: true, data: newOrder });
});

app.get('/api/orders/:id/contract', (req, res) => {
  const order = orders.find(o => o.id === req.params.id);
  if (!order) {
    return res.status(404).json({ success: false, message: 'Заявка не найдена' });
  }

  const contractHtml = `
  <!DOCTYPE html>
  <html lang="ru">
  <head>
    <meta charset="UTF-8">
    <title>Договор-Заявка ${order.id}</title>
    <style>
      body { font-family: 'Times New Roman', serif; font-size: 14px; margin: 30px; line-height: 1.4; }
      h2 { text-align: center; font-size: 18px; margin-bottom: 5px; }
      .header-sub { text-align: center; font-size: 12px; color: #555; margin-bottom: 20px; }
      table { width: 100%; border-collapse: collapse; margin-top: 15px; }
      th, td { border: 1px solid #333; padding: 8px; text-align: left; vertical-align: top; }
      th { background-color: #f2f2f2; width: 30%; }
      .signatures { margin-top: 40px; display: flex; justify-content: space-between; }
      .sig-box { width: 45%; border-top: 1px solid #000; pt: 5px; }
    </style>
  </head>
  <body>
    <h2>ДОГОВОР-ЗАЯВКА № ${order.id}</h2>
    <div class="header-sub">на перевозку груза автомобильным транспортом | Дата: ${order.orderDate}</div>

    <table>
      <tr><th>Экспедитор / Диспетчер</th><td>ООО "АТИ-ЭКСПЕДИЦИЯ РУС", ИНН 7709988776, Тел: +7 (800) 555-35-35</td></tr>
      <tr><th>Заказчик (Грузоотправитель)</th><td>${order.shipperName} (ИНН ${order.shipperInn})</td></tr>
      <tr><th>Перевозчик</th><td>${order.carrierName} (ИНН ${order.carrierInn})</td></tr>
      <tr><th>Водитель / Тягач / Прицеп</th><td>${order.driverName}, Паспорт: ${order.driverPassport}. Госномер: ${order.truckRegNumber}</td></tr>
      <tr><th>Маршрут (Погрузка - Разгрузка)</th><td><b>ОТКУДА:</b> ${order.routeFrom}<br><b>КУДА:</b> ${order.routeTo}</td></tr>
      <tr><th>Наименование груза и вес</th><td>${order.cargoName}</td></tr>
      <tr><th>Стоимость перевозки для Заказчика</th><td><b>${order.rateShipperRub.toLocaleString('ru-RU')} руб.</b></td></tr>
      <tr><th>Оплата Перевозчику</th><td><b>${order.rateCarrierRub.toLocaleString('ru-RU')} руб.</b> (${order.paymentTerms})</td></tr>
      <tr><th>Вознаграждение Диспетчера</th><td><b>${order.expeditorMarginRub.toLocaleString('ru-RU')} руб.</b></td></tr>
    </table>

    <div style="margin-top:20px; font-size:12px;">
      <b>Условия перевозки:</b> Перевозчик несет полную материальную ответственность за сохранность груза с момента принятия его к перевозке и до сдачи Получателю. Опоздание под погрузку/разгрузку — штраф 3000 руб./сутки.
    </div>

    <div class="signatures">
      <div class="sig-box">
        <b>ОТ ЭКСПЕДИТОРА / ПЕРЕВОЗЧИКА:</b><br><br><br>
        ___________________ / ${order.driverName} /<br>
        М.П.
      </div>
      <div class="sig-box">
        <b>ОТ ЗАКАЗЧИКА:</b><br><br><br>
        ___________________ / Представитель /<br>
        М.П.
      </div>
    </div>
  </body>
  </html>
  `;

  res.send(contractHtml);
});

// Fallback route for SPA - Express 5 wildcard syntax
app.get('/{0,}', (req, res) => {
  if (fs.existsSync(path.join(distPath, 'index.html'))) {
    res.sendFile(path.join(distPath, 'index.html'));
  } else {
    res.status(404).send('Not Found');
  }
});

const PORT = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Logistics Dispatcher Server running on port ${PORT}`);
  });
}

module.exports = app;
