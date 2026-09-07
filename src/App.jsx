import React, { useState, useEffect } from 'react';
import {
  Truck,
  Package,
  Calculator,
  Search,
  FileText,
  ShieldCheck,
  PlusCircle,
  MapPin,
  Calendar,
  Phone,
  CheckCircle2,
  AlertTriangle,
  FileCheck,
  DollarSign,
  ArrowRight,
  Filter,
  RefreshCw,
  Printer
} from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('cargos'); // 'cargos', 'transports', 'norms', 'calculator', 'orders', 'counterparties'

  // Cargos State
  const [cargos, setCargos] = useState([]);
  const [cargoFilter, setCargoFilter] = useState({ from: '', to: '', bodyType: 'Все' });
  const [showAddCargoModal, setShowAddCargoModal] = useState(false);
  const [newCargo, setNewCargo] = useState({
    fromLocation: '',
    toLocation: '',
    cargoName: '',
    weightTons: '20',
    volumeM3: '86',
    bodyType: 'Тент / Штора',
    rateRub: '90000',
    shipperName: '',
    shipperInn: '',
    contactPhone: '+7 (999) 000-00-00'
  });

  // Transports State
  const [transports, setTransports] = useState([]);
  const [transportFilter, setTransportFilter] = useState({ current: '', destination: '', truckType: 'Все' });
  const [showAddTransportModal, setShowAddTransportModal] = useState(false);
  const [newTransport, setNewTransport] = useState({
    currentLocation: '',
    destinationLocation: 'Любое направление',
    truckType: 'Еврофура (Тент 92м³)',
    maxCapacityTons: '20',
    maxVolumeM3: '92',
    carrierName: '',
    carrierInn: '',
    driverName: '',
    driverPhone: '+7 (999) 111-22-33',
    truckRegNumber: 'А 123 АА 777'
  });

  // Loading Norms State
  const [productType, setProductType] = useState('pipe'); // 'pipe' | 'fitting'
  const [shellDiameter, setShellDiameter] = useState('160');
  const [stakeHeight, setStakeHeight] = useState('2.0');
  const [pipeCount, setPipeCount] = useState('200');
  const [normsResult, setNormsResult] = useState(null);
  const [pipeNormsList, setPipeNormsList] = useState([]);
  const [fittingNormsList, setFittingNormsList] = useState([]);

  // Route Calc State
  const [routeCalc, setRouteCalc] = useState({
    fromCity: 'Москва',
    toCity: 'Санкт-Петербург',
    truckWeightTons: '20',
    expeditorCommissionPercent: '10'
  });
  const [calcResult, setCalcResult] = useState(null);

  // Counterparties State
  const [counterparties, setCounterparties] = useState([]);
  const [searchInn, setSearchInn] = useState('');

  // Orders State
  const [orders, setOrders] = useState([]);
  const [showNewOrderModal, setShowNewOrderModal] = useState(false);
  const [contractOrder, setContractOrder] = useState(null);
  const [newOrderForm, setNewOrderForm] = useState({
    shipperName: 'ООО "Логистик Групп"',
    shipperInn: '7701234567',
    carrierName: 'ООО "Магистраль Транс"',
    carrierInn: '7722445566',
    driverName: 'Иванов Петр Сергеевич',
    driverPassport: '4510 № 889900',
    truckRegNumber: 'А 777 АА 777',
    routeFrom: 'г. Москва',
    routeTo: 'г. Санкт-Петербург',
    cargoName: 'Запчасти и оборудование (20т)',
    rateShipperRub: '95000',
    rateCarrierRub: '85000',
    paymentTerms: 'Оплата по оригиналу ТТН 5 банковских дней'
  });

  // Fetch initial data
  const loadCargos = async () => {
    try {
      const query = new URLSearchParams(cargoFilter).toString();
      const res = await fetch(`/api/cargos?${query}`);
      const data = await res.json();
      if (data.success) setCargos(data.data);
    } catch (e) {
      console.error(e);
    }
  };

  const loadTransports = async () => {
    try {
      const query = new URLSearchParams(transportFilter).toString();
      const res = await fetch(`/api/transports?${query}`);
      const data = await res.json();
      if (data.success) setTransports(data.data);
    } catch (e) {
      console.error(e);
    }
  };

  const loadLoadingNormsData = async () => {
    try {
      const [resP, resF] = await Promise.all([
        fetch('/api/loading-norms/pipes'),
        fetch('/api/loading-norms/fittings')
      ]);
      const dataP = await resP.json();
      const dataF = await resF.json();
      if (dataP.success) setPipeNormsList(dataP.data);
      if (dataF.success) setFittingNormsList(dataF.data);
    } catch (e) {
      console.error(e);
    }
  };

  const loadCounterparties = async () => {
    try {
      const res = await fetch(`/api/counterparties?query=${encodeURIComponent(searchInn)}`);
      const data = await res.json();
      if (data.success) setCounterparties(data.data);
    } catch (e) {
      console.error(e);
    }
  };

  const loadOrders = async () => {
    try {
      const res = await fetch('/api/orders');
      const data = await res.json();
      if (data.success) setOrders(data.data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadCargos();
  }, [cargoFilter]);

  useEffect(() => {
    loadTransports();
  }, [transportFilter]);

  useEffect(() => {
    loadLoadingNormsData();
    loadCounterparties();
    loadOrders();
    handleRouteCalc();
    handleCalculateNorms();
  }, []);

  // Handlers
  const handleAddCargo = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/cargos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCargo)
      });
      const data = await res.json();
      if (data.success) {
        setShowAddCargoModal(false);
        setNewCargo({
          fromLocation: '',
          toLocation: '',
          cargoName: '',
          weightTons: '20',
          volumeM3: '86',
          bodyType: 'Тент / Штора',
          rateRub: '90000',
          shipperName: '',
          shipperInn: '',
          contactPhone: '+7 (999) 000-00-00'
        });
        loadCargos();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddTransport = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/transports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTransport)
      });
      const data = await res.json();
      if (data.success) {
        setShowAddTransportModal(false);
        setNewTransport({
          currentLocation: '',
          destinationLocation: 'Любое направление',
          truckType: 'Еврофура (Тент 92м³)',
          maxCapacityTons: '20',
          maxVolumeM3: '92',
          carrierName: '',
          carrierInn: '',
          driverName: '',
          driverPhone: '+7 (999) 111-22-33',
          truckRegNumber: 'А 123 АА 777'
        });
        loadTransports();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleCalculateNorms = async (e) => {
    if (e) e.preventDefault();
    try {
      const res = await fetch('/api/loading-norms/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productType,
          shellDiameter,
          stakeHeight,
          pipeCount
        })
      });
      const data = await res.json();
      if (data.success) setNormsResult(data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleRouteCalc = async (e) => {
    if (e) e.preventDefault();
    try {
      const res = await fetch('/api/route-calc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(routeCalc)
      });
      const data = await res.json();
      if (data.success) setCalcResult(data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateOrder = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newOrderForm)
      });
      const data = await res.json();
      if (data.success) {
        setShowNewOrderModal(false);
        loadOrders();
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 flex flex-col">
      {/* ATI Header Top Line */}
      <header className="bg-slate-900 text-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-blue-600 text-white font-black px-3 py-1 rounded text-xl tracking-wider shadow">
              ATI<span className="text-blue-300">.SU</span>
            </div>
            <div>
              <h1 className="font-bold text-lg leading-none">АРМ Диспетчера-Экспедитора</h1>
              <span className="text-xs text-slate-400">Российская Биржа Грузов и Транспорта</span>
            </div>
          </div>
          <div className="flex items-center space-x-6 text-sm">
            <div className="flex items-center space-x-2 bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-slate-200">Сервер ATI: <strong className="text-emerald-400">Онлайн</strong></span>
            </div>
            <div className="hidden md:block text-slate-300 text-right">
              <div className="font-medium text-white">ООО "Ати-Логистик Центр"</div>
              <div className="text-xs text-blue-400">ATI Код: 128-490 • Рейтинг: ★ 4.95</div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs Bar */}
        <div className="bg-blue-800 border-t border-blue-700">
          <div className="max-w-7xl mx-auto px-4 flex overflow-x-auto space-x-1">
            <button
              onClick={() => setActiveTab('cargos')}
              className={`flex items-center space-x-2 px-4 py-3 font-medium text-sm transition border-b-2 whitespace-nowrap ${
                activeTab === 'cargos'
                  ? 'bg-blue-900 border-amber-400 text-white font-semibold'
                  : 'text-blue-100 hover:bg-blue-700 border-transparent'
              }`}
            >
              <Package className="w-4 h-4 text-amber-400" />
              <span>Поиск Грузов ({cargos.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('transports')}
              className={`flex items-center space-x-2 px-4 py-3 font-medium text-sm transition border-b-2 whitespace-nowrap ${
                activeTab === 'transports'
                  ? 'bg-blue-900 border-amber-400 text-white font-semibold'
                  : 'text-blue-100 hover:bg-blue-700 border-transparent'
              }`}
            >
              <Truck className="w-4 h-4 text-emerald-400" />
              <span>Поиск Машин ({transports.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('norms')}
              className={`flex items-center space-x-2 px-4 py-3 font-medium text-sm transition border-b-2 whitespace-nowrap ${
                activeTab === 'norms'
                  ? 'bg-blue-900 border-amber-400 text-white font-semibold'
                  : 'text-blue-100 hover:bg-blue-700 border-transparent'
              }`}
            >
              <Calculator className="w-4 h-4 text-amber-300" />
              <span>Нормы Погрузки (Трубы/Фасонка)</span>
            </button>

            <button
              onClick={() => setActiveTab('calculator')}
              className={`flex items-center space-x-2 px-4 py-3 font-medium text-sm transition border-b-2 whitespace-nowrap ${
                activeTab === 'calculator'
                  ? 'bg-blue-900 border-amber-400 text-white font-semibold'
                  : 'text-blue-100 hover:bg-blue-700 border-transparent'
              }`}
            >
              <DollarSign className="w-4 h-4 text-green-300" />
              <span>Расчет Маршрута & Фрахта</span>
            </button>

            <button
              onClick={() => setActiveTab('orders')}
              className={`flex items-center space-x-2 px-4 py-3 font-medium text-sm transition border-b-2 whitespace-nowrap ${
                activeTab === 'orders'
                  ? 'bg-blue-900 border-amber-400 text-white font-semibold'
                  : 'text-blue-100 hover:bg-blue-700 border-transparent'
              }`}
            >
              <FileText className="w-4 h-4 text-purple-300" />
              <span>Договоры-Заявки ({orders.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('counterparties')}
              className={`flex items-center space-x-2 px-4 py-3 font-medium text-sm transition border-b-2 whitespace-nowrap ${
                activeTab === 'counterparties'
                  ? 'bg-blue-900 border-amber-400 text-white font-semibold'
                  : 'text-blue-100 hover:bg-blue-700 border-transparent'
              }`}
            >
              <ShieldCheck className="w-4 h-4 text-emerald-300" />
              <span>Паспорт ATI / Проверка ИНН</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 py-6 flex-grow w-full">
        {/* TAB 1: CARGOS */}
        {activeTab === 'cargos' && (
          <div className="space-y-4">
            {/* Filter Bar */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3 flex-grow">
                <div className="flex items-center space-x-2 bg-slate-50 px-3 py-2 rounded-lg border border-slate-300">
                  <MapPin className="w-4 h-4 text-red-500" />
                  <input
                    type="text"
                    placeholder="Откуда (напр. Москва)"
                    value={cargoFilter.from}
                    onChange={(e) => setCargoFilter({ ...cargoFilter, from: e.target.value })}
                    className="bg-transparent outline-none text-sm w-36"
                  />
                </div>

                <ArrowRight className="w-4 h-4 text-slate-400 hidden sm:block" />

                <div className="flex items-center space-x-2 bg-slate-50 px-3 py-2 rounded-lg border border-slate-300">
                  <MapPin className="w-4 h-4 text-emerald-500" />
                  <input
                    type="text"
                    placeholder="Куда (напр. СПБ)"
                    value={cargoFilter.to}
                    onChange={(e) => setCargoFilter({ ...cargoFilter, to: e.target.value })}
                    className="bg-transparent outline-none text-sm w-36"
                  />
                </div>

                <div className="flex items-center space-x-2 bg-slate-50 px-3 py-2 rounded-lg border border-slate-300">
                  <Filter className="w-4 h-4 text-slate-500" />
                  <select
                    value={cargoFilter.bodyType}
                    onChange={(e) => setCargoFilter({ ...cargoFilter, bodyType: e.target.value })}
                    className="bg-transparent outline-none text-sm cursor-pointer"
                  >
                    <option value="Все">Все кузова</option>
                    <option value="Тент">Тент / Штора</option>
                    <option value="Рефрижератор">Рефрижератор</option>
                    <option value="Бортовой">Бортовой / Шаланда</option>
                  </select>
                </div>

                <button
                  onClick={loadCargos}
                  className="flex items-center space-x-1.5 bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-700 transition"
                >
                  <Search className="w-4 h-4" />
                  <span>Найти</span>
                </button>
              </div>

              <button
                onClick={() => setShowAddCargoModal(true)}
                className="flex items-center space-x-2 bg-emerald-600 text-white px-4 py-2 rounded-lg font-medium text-sm hover:bg-emerald-700 transition shadow"
              >
                <PlusCircle className="w-4 h-4" />
                <span>+ Добавить Груз</span>
              </button>
            </div>

            {/* Cargo Cards List */}
            <div className="space-y-3">
              {cargos.length === 0 ? (
                <div className="bg-white p-8 text-center rounded-xl border border-slate-200 text-slate-500">
                  Грузы по заданным фильтрам не найдены.
                </div>
              ) : (
                cargos.map((cargo) => (
                  <div
                    key={cargo.id}
                    className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="space-y-2 flex-grow">
                      <div className="flex items-center space-x-3 flex-wrap gap-2">
                        <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2.5 py-1 rounded">
                          {cargo.id}
                        </span>
                        <div className="text-lg font-bold text-slate-900 flex items-center space-x-2">
                          <span>{cargo.fromLocation}</span>
                          <span className="text-blue-600">→</span>
                          <span>{cargo.toLocation}</span>
                        </div>
                        <span className="bg-emerald-100 text-emerald-800 text-xs font-medium px-2.5 py-1 rounded-full flex items-center space-x-1">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>{cargo.status}</span>
                        </span>
                      </div>

                      <div className="text-sm font-semibold text-slate-700">
                        {cargo.cargoName} • <span className="text-slate-500 font-normal">{cargo.weightTons} т / {cargo.volumeM3} м³</span>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                        <div className="flex items-center space-x-1">
                          <Truck className="w-3.5 h-3.5 text-slate-400" />
                          <span>Кузов: <strong>{cargo.bodyType}</strong> ({cargo.loadingType})</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>Дата загрузки: <strong>{cargo.loadDate}</strong></span>
                        </div>
                      </div>

                      <div className="text-xs text-slate-500 pt-1 border-t border-slate-100 flex items-center space-x-3">
                        <span className="font-medium text-slate-700">{cargo.shipperName} (ИНН: {cargo.shipperInn})</span>
                        <span className="text-amber-600 font-bold">★ ATI {cargo.atiRating}</span>
                        <span><Phone className="w-3 h-3 inline mr-1 text-slate-400" />{cargo.contactPhone}</span>
                      </div>
                    </div>

                    <div className="flex flex-col items-end justify-between border-t md:border-t-0 md:border-l border-slate-100 pt-3 md:pt-0 md:pl-5 space-y-3 min-w-[200px]">
                      <div className="text-right">
                        <div className="text-2xl font-black text-blue-900">
                          {cargo.rateRub.toLocaleString('ru-RU')} ₽
                        </div>
                        <div className="text-xs text-slate-500 font-medium">{cargo.paymentType}</div>
                      </div>

                      <button
                        onClick={() => {
                          setNewOrderForm({
                            ...newOrderForm,
                            shipperName: cargo.shipperName,
                            shipperInn: cargo.shipperInn,
                            routeFrom: cargo.fromLocation,
                            routeTo: cargo.toLocation,
                            cargoName: `${cargo.cargoName} (${cargo.weightTons}т / ${cargo.volumeM3}м³)`,
                            rateShipperRub: cargo.rateRub.toString(),
                            rateCarrierRub: Math.round(cargo.rateRub * 0.9).toString()
                          });
                          setShowNewOrderModal(true);
                        }}
                        className="w-full bg-blue-600 text-white text-xs font-bold px-4 py-2.5 rounded-lg hover:bg-blue-700 transition shadow"
                      >
                        Оформить Заявку
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB 2: TRANSPORTS */}
        {activeTab === 'transports' && (
          <div className="space-y-4">
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3 flex-grow">
                <div className="flex items-center space-x-2 bg-slate-50 px-3 py-2 rounded-lg border border-slate-300">
                  <MapPin className="w-4 h-4 text-emerald-500" />
                  <input
                    type="text"
                    placeholder="Где машина (город)"
                    value={transportFilter.current}
                    onChange={(e) => setTransportFilter({ ...transportFilter, current: e.target.value })}
                    className="bg-transparent outline-none text-sm w-40"
                  />
                </div>

                <div className="flex items-center space-x-2 bg-slate-50 px-3 py-2 rounded-lg border border-slate-300">
                  <Filter className="w-4 h-4 text-slate-500" />
                  <select
                    value={transportFilter.truckType}
                    onChange={(e) => setTransportFilter({ ...transportFilter, truckType: e.target.value })}
                    className="bg-transparent outline-none text-sm cursor-pointer"
                  >
                    <option value="Все">Все типы ТС</option>
                    <option value="Тент">Еврофура Тент</option>
                    <option value="Рефрижератор">Рефрижератор</option>
                    <option value="Бортовой">Шаланда / Бортовой</option>
                  </select>
                </div>

                <button
                  onClick={loadTransports}
                  className="flex items-center space-x-1.5 bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-700 transition"
                >
                  <Search className="w-4 h-4" />
                  <span>Найти ТС</span>
                </button>
              </div>

              <button
                onClick={() => setShowAddTransportModal(true)}
                className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg font-medium text-sm hover:bg-blue-700 transition shadow"
              >
                <PlusCircle className="w-4 h-4" />
                <span>+ Добавить Машину</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {transports.map((t) => (
                <div key={t.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="font-bold text-slate-900 flex items-center space-x-2">
                      <Truck className="w-5 h-5 text-blue-600" />
                      <span>{t.truckType}</span>
                    </span>
                    <span className="bg-amber-100 text-amber-800 text-xs font-bold px-2 py-0.5 rounded">
                      ★ ATI {t.atiRating}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <div className="text-xs text-slate-400">Дислокация</div>
                      <div className="font-semibold text-slate-800">{t.currentLocation}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-400">Направление</div>
                      <div className="font-semibold text-slate-800">{t.destinationLocation}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-400">Грузоподъемность / Объём</div>
                      <div className="font-semibold text-slate-800">{t.maxCapacityTons} т / {t.maxVolumeM3} м³</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-400">Готов к погрузке</div>
                      <div className="font-semibold text-emerald-600">{t.readyDate}</div>
                    </div>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-lg text-xs space-y-1 text-slate-600 border border-slate-200">
                    <div><strong>Перевозчик:</strong> {t.carrierName} (ИНН {t.carrierInn})</div>
                    <div><strong>Водитель:</strong> {t.driverName} ({t.driverPhone})</div>
                    <div><strong>Госномер:</strong> {t.truckRegNumber}</div>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <div className="text-sm font-bold text-slate-800">
                      Ставка: <span className="text-blue-600">{t.ratePerKmRub} ₽/км</span>
                    </div>
                    <button
                      onClick={() => {
                        setNewOrderForm({
                          ...newOrderForm,
                          carrierName: t.carrierName,
                          carrierInn: t.carrierInn,
                          driverName: t.driverName,
                          truckRegNumber: t.truckRegNumber
                        });
                        setActiveTab('orders');
                        setShowNewOrderModal(true);
                      }}
                      className="bg-slate-800 text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-slate-700 transition"
                    >
                      Назначить на Рейс
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: LOADING NORMS (EXCEL DATA INTEGRATED) */}
        {activeTab === 'norms' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
              <div className="flex items-center space-x-3 border-b border-slate-200 pb-4 mb-4">
                <Calculator className="w-6 h-6 text-blue-600" />
                <div>
                  <h2 className="text-xl font-bold text-slate-900">
                    Калькулятор Норм Погрузки (Трубы и Фасонка)
                  </h2>
                  <p className="text-xs text-slate-500">
                    Официальные нормы вместимости для еврофур из регламентов производства
                  </p>
                </div>
              </div>

              <form onSubmit={handleCalculateNorms} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Тип продукции</label>
                  <select
                    value={productType}
                    onChange={(e) => setProductType(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-sm font-medium"
                  >
                    <option value="pipe">Труба в ППУ изоляции</option>
                    <option value="fitting">Фасонные изделия (Отводы, НОП, Концевые)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Диаметр оболочки (мм)</label>
                  <select
                    value={shellDiameter}
                    onChange={(e) => setShellDiameter(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-sm font-medium"
                  >
                    {pipeNormsList.map((p) => (
                      <option key={p.shell_diameter || p.shellDiameter} value={p.shell_diameter || p.shellDiameter}>
                        {p.shell_diameter || p.shellDiameter} мм
                      </option>
                    ))}
                  </select>
                </div>

                {productType === 'pipe' ? (
                  <>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Высота коней (бортов)</label>
                      <select
                        value={stakeHeight}
                        onChange={(e) => setStakeHeight(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-sm font-medium"
                      >
                        <option value="1.8">1,8 метра</option>
                        <option value="2.0">2,0 метра (Стандарт)</option>
                        <option value="2.2">2,2 метра (Увеличенная)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Количество труб (шт)</label>
                      <input
                        type="number"
                        value={pipeCount}
                        onChange={(e) => setPipeCount(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-sm font-medium"
                      />
                    </div>
                  </>
                ) : (
                  <div className="col-span-2 text-xs text-slate-500 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                    *Фасонка рассчитывается по количеству изделий на 1 конец полуприцепа (фуры).
                  </div>
                )}

                <div className="col-span-full mt-2">
                  <button
                    type="submit"
                    className="bg-blue-600 text-white font-bold text-sm px-6 py-2.5 rounded-lg hover:bg-blue-700 transition shadow"
                  >
                    Рассчитать количество фур
                  </button>
                </div>
              </form>

              {/* Calculation Result Display */}
              {normsResult && (
                <div className="mt-6 p-5 bg-blue-50 border border-blue-200 rounded-xl space-y-3">
                  <div className="text-lg font-bold text-blue-900 border-b border-blue-200 pb-2">
                    Результат расчета погрузки
                  </div>

                  {normsResult.productType === 'Труба в ППУ изоляции' ? (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-center">
                      <div className="bg-white p-3 rounded-lg border border-blue-100 shadow-sm">
                        <div className="text-xs text-slate-500">Норма в 1 фуру</div>
                        <div className="text-2xl font-black text-slate-800">{normsResult.normPerTruck} шт</div>
                      </div>
                      <div className="bg-white p-3 rounded-lg border border-blue-100 shadow-sm">
                        <div className="text-xs text-slate-500">Общее кол-во</div>
                        <div className="text-2xl font-black text-slate-800">{normsResult.requestedCount} шт</div>
                      </div>
                      <div className="bg-white p-3 rounded-lg border border-blue-100 shadow-sm">
                        <div className="text-xs text-slate-500">Требуется фур</div>
                        <div className="text-2xl font-black text-blue-600">{normsResult.requiredTrucks} ед.</div>
                      </div>
                      <div className="bg-white p-3 rounded-lg border border-blue-100 shadow-sm">
                        <div className="text-xs text-slate-500">Загрузка ТС</div>
                        <div className="text-2xl font-black text-emerald-600">{normsResult.loadingEfficiencyPercent}%</div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2 text-sm text-slate-800">
                      <div><strong>Диаметр оболочки:</strong> {normsResult.shellDiameter} мм</div>
                      <div className="grid grid-cols-3 gap-3 pt-2">
                        <div className="bg-white p-3 rounded-lg border border-slate-200 text-center">
                          <div className="text-xs text-slate-500">Отводы укороченные (ПЭ/ОЦ)</div>
                          <div className="text-xl font-bold text-slate-900">{normsResult.normsOneEndTruck.bends || '—'} шт/конец</div>
                        </div>
                        <div className="bg-white p-3 rounded-lg border border-slate-200 text-center">
                          <div className="text-xs text-slate-500">НОП (L=1500мм)</div>
                          <div className="text-xl font-bold text-slate-900">{normsResult.normsOneEndTruck.nop || '—'} шт/конец</div>
                        </div>
                        <div className="bg-white p-3 rounded-lg border border-slate-200 text-center">
                          <div className="text-xs text-slate-500">Концевой элемент (L=2200мм)</div>
                          <div className="text-xl font-bold text-slate-900">{normsResult.normsOneEndTruck.end_element || '—'} шт/конец</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Reference Loading Tables */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
              <h3 className="font-bold text-base text-slate-800 mb-3">Справочные таблицы норм погрузки (Из файлов Excel)</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 border-b border-slate-300">
                      <th className="p-2 border">Диаметр оболочки (мм)</th>
                      <th className="p-2 border">Высота коней 1.8м (шт)</th>
                      <th className="p-2 border">Высота коней 2.0м (шт)</th>
                      <th className="p-2 border">Высота коней 2.2м (шт)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pipeNormsList.map((row) => (
                      <tr key={row.shell_diameter || row.shellDiameter} className="hover:bg-slate-50 border-b">
                        <td className="p-2 border font-bold text-blue-900">{row.shell_diameter || row.shellDiameter}</td>
                        <td className="p-2 border">{row.h1_8}</td>
                        <td className="p-2 border font-semibold">{row.h2_0}</td>
                        <td className="p-2 border">{row.h2_2}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: ROUTE & FREIGHT CALCULATOR */}
        {activeTab === 'calculator' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
              <div className="flex items-center space-x-3 border-b border-slate-200 pb-4 mb-4">
                <DollarSign className="w-6 h-6 text-emerald-600" />
                <div>
                  <h2 className="text-xl font-bold text-slate-900">
                    Калькулятор Маршрута & Доходности Экспедитора
                  </h2>
                  <p className="text-xs text-slate-500">
                    Расчет километража, времени в пути, расхода топлива и маржинальности экспедирования
                  </p>
                </div>
              </div>

              <form onSubmit={handleRouteCalc} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Город отправления</label>
                  <select
                    value={routeCalc.fromCity}
                    onChange={(e) => setRouteCalc({ ...routeCalc, fromCity: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-sm font-medium"
                  >
                    <option value="Москва">Москва</option>
                    <option value="Санкт-Петербург">Санкт-Петербург</option>
                    <option value="Екатеринбург">Екатеринбург</option>
                    <option value="Казань">Казань</option>
                    <option value="Нижний Новгород">Нижний Новгород</option>
                    <option value="Краснодар">Краснодар</option>
                    <option value="Новосибирск">Новосибирск</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Город назначения</label>
                  <select
                    value={routeCalc.toCity}
                    onChange={(e) => setRouteCalc({ ...routeCalc, toCity: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-sm font-medium"
                  >
                    <option value="Санкт-Петербург">Санкт-Петербург</option>
                    <option value="Москва">Москва</option>
                    <option value="Екатеринбург">Екатеринбург</option>
                    <option value="Казань">Казань</option>
                    <option value="Нижний Новгород">Нижний Новгород</option>
                    <option value="Краснодар">Краснодар</option>
                    <option value="Новосибирск">Новосибирск</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Вес груза (Тонн)</label>
                  <input
                    type="number"
                    value={routeCalc.truckWeightTons}
                    onChange={(e) => setRouteCalc({ ...routeCalc, truckWeightTons: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-sm font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Комиссия Диспетчера (%)</label>
                  <input
                    type="number"
                    value={routeCalc.expeditorCommissionPercent}
                    onChange={(e) => setRouteCalc({ ...routeCalc, expeditorCommissionPercent: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-sm font-medium"
                  />
                </div>

                <div className="col-span-full mt-2">
                  <button
                    type="submit"
                    className="bg-emerald-600 text-white font-bold text-sm px-6 py-2.5 rounded-lg hover:bg-emerald-700 transition shadow"
                  >
                    Рассчитать фрахт и маржу
                  </button>
                </div>
              </form>

              {calcResult && (
                <div className="mt-6 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                      <div className="text-xs text-slate-500 font-bold uppercase">Расстояние и Время</div>
                      <div className="text-2xl font-black text-slate-900 mt-1">{calcResult.distanceKm} км</div>
                      <div className="text-xs text-slate-600 mt-1">
                        ~{calcResult.drivingHours} часов пути ({calcResult.daysInTransit} сут. с учетом отдыха)
                      </div>
                    </div>

                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                      <div className="text-xs text-slate-500 font-bold uppercase">Затраты на ДТ</div>
                      <div className="text-2xl font-black text-slate-900 mt-1">
                        {calcResult.fuelConsumption.costRub.toLocaleString('ru-RU')} ₽
                      </div>
                      <div className="text-xs text-slate-600 mt-1">
                        {calcResult.fuelConsumption.liters} литров (по {calcResult.fuelConsumption.fuelPricePerLiter} ₽/л)
                      </div>
                    </div>

                    <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200">
                      <div className="text-xs text-emerald-800 font-bold uppercase">Заработок Диспетчера</div>
                      <div className="text-2xl font-black text-emerald-700 mt-1">
                        {calcResult.freightCalculation.expeditorMarginRub.toLocaleString('ru-RU')} ₽
                      </div>
                      <div className="text-xs text-emerald-700 mt-1">
                        Чистая маржа экспедитора ({calcResult.freightCalculation.expeditorMarginPercent}%)
                      </div>
                    </div>
                  </div>

                  <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-2">
                    <h4 className="font-bold text-sm text-slate-800">Рекомендуемый расчет ставок:</h4>
                    <div className="flex flex-col sm:flex-row justify-between p-3 bg-slate-50 rounded-lg text-sm border">
                      <span>Ставка Перевозчику (Себестоимость):</span>
                      <strong className="text-slate-900">{calcResult.freightCalculation.carrierRateRub.toLocaleString('ru-RU')} ₽</strong>
                    </div>
                    <div className="flex flex-col sm:flex-row justify-between p-3 bg-blue-50 rounded-lg text-sm border border-blue-200">
                      <span className="font-bold text-blue-900">Итоговая ставка для Грузоотправителя:</span>
                      <strong className="text-blue-900 text-lg">
                        {calcResult.freightCalculation.shipperRateRub.toLocaleString('ru-RU')} ₽
                      </strong>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 5: ORDERS & CONTRACT GENERATOR */}
        {activeTab === 'orders' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-white p-4 rounded-xl shadow-sm border border-slate-200">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Реестр Договоров-Заявок</h2>
                <p className="text-xs text-slate-500">Управление рейсами и печать юридических документов</p>
              </div>
              <button
                onClick={() => setShowNewOrderModal(true)}
                className="bg-purple-600 text-white font-medium text-sm px-4 py-2 rounded-lg hover:bg-purple-700 transition shadow"
              >
                + Сформировать Договор-Заявку
              </button>
            </div>

            <div className="space-y-3">
              {orders.map((ord) => (
                <div key={ord.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <div className="flex items-center space-x-3">
                      <span className="bg-purple-100 text-purple-800 text-xs font-bold px-2.5 py-1 rounded">
                        {ord.id}
                      </span>
                      <span className="text-sm font-bold text-slate-800">Дата: {ord.orderDate}</span>
                    </div>
                    <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-2.5 py-0.5 rounded">
                      {ord.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-xs text-slate-400">Грузоотправитель (Заказчик)</div>
                      <div className="font-semibold text-slate-900">{ord.shipperName} (ИНН {ord.shipperInn})</div>
                      <div className="text-xs text-slate-600">Ставка заказчика: <strong>{ord.rateShipperRub.toLocaleString('ru-RU')} ₽</strong></div>
                    </div>

                    <div>
                      <div className="text-xs text-slate-400">Перевозчик</div>
                      <div className="font-semibold text-slate-900">{ord.carrierName} (ИНН {ord.carrierInn})</div>
                      <div className="text-xs text-slate-600">Ставка перевозчику: <strong>{ord.rateCarrierRub.toLocaleString('ru-RU')} ₽</strong></div>
                    </div>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-lg text-xs space-y-1 text-slate-700 border">
                    <div><strong>Маршрут:</strong> {ord.routeFrom} → {ord.routeTo}</div>
                    <div><strong>Груз:</strong> {ord.cargoName}</div>
                    <div><strong>Водитель & ТС:</strong> {ord.driverName} | {ord.truckRegNumber}</div>
                    <div className="text-purple-700 font-bold">Маржа Диспетчера: {ord.expeditorMarginRub.toLocaleString('ru-RU')} ₽</div>
                  </div>

                  <div className="flex justify-end space-x-2 pt-2">
                    <button
                      onClick={() => window.open(`/api/orders/${ord.id}/contract`, '_blank')}
                      className="flex items-center space-x-1 bg-slate-800 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-slate-700 transition"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Открыть Договор-Заявку (Печать)</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 6: ATI PASSPORT / COUNTERPARTY CHECK */}
        {activeTab === 'counterparties' && (
          <div className="space-y-4">
            <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 space-y-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Проверка Контрагента (ATI Паспорт)</h2>
                <p className="text-xs text-slate-500">Проверка ИНН, рейтинга надёжности и претензий перед заключением сделки</p>
              </div>

              <div className="flex gap-2 max-w-lg">
                <input
                  type="text"
                  placeholder="Введите ИНН или Название компании"
                  value={searchInn}
                  onChange={(e) => setSearchInn(e.target.value)}
                  className="flex-grow bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm"
                />
                <button
                  onClick={loadCounterparties}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition"
                >
                  Проверить
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {counterparties.map((cp) => (
                <div key={cp.inn} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
                  <div className="flex items-center justify-between border-b pb-2">
                    <div>
                      <h3 className="font-bold text-slate-900">{cp.name}</h3>
                      <div className="text-xs text-slate-500">ИНН: {cp.inn} | ОГРН: {cp.ogrn}</div>
                    </div>
                    <span className={`text-sm font-black px-2.5 py-1 rounded ${
                      cp.atiColor === 'green' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                    }`}>
                      ★ {cp.atiScore}
                    </span>
                  </div>

                  <div className="text-xs space-y-1 text-slate-700">
                    <div><strong>Директор:</strong> {cp.director}</div>
                    <div><strong>Юр. Адрес:</strong> {cp.verifiedAddress}</div>
                    <div><strong>Стаж в ATI:</strong> {cp.yearsInAti} лет</div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-2 text-center text-xs">
                    <div className="bg-slate-50 p-2 rounded border">
                      <div className="text-slate-400">Претензии</div>
                      <div className={`font-bold ${cp.claimsCount > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                        {cp.claimsCount} шт
                      </div>
                    </div>
                    <div className="bg-slate-50 p-2 rounded border">
                      <div className="text-slate-400">НП (Неоплаты)</div>
                      <div className={`font-bold ${cp.unpaidCount > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                        {cp.unpaidCount} шт
                      </div>
                    </div>
                    <div className="bg-slate-50 p-2 rounded border">
                      <div className="text-slate-400">Рекомендации</div>
                      <div className="font-bold text-blue-600">{cp.recommendationsCount}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* MODAL: Add Cargo */}
      {showAddCargoModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 space-y-4 shadow-xl">
            <h3 className="font-bold text-lg text-slate-900 border-b pb-2">Добавление нового груза в ATI</h3>
            <form onSubmit={handleAddCargo} className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold mb-1">Откуда</label>
                  <input
                    type="text"
                    required
                    value={newCargo.fromLocation}
                    onChange={(e) => setNewCargo({ ...newCargo, fromLocation: e.target.value })}
                    className="w-full border rounded p-2"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1">Куда</label>
                  <input
                    type="text"
                    required
                    value={newCargo.toLocation}
                    onChange={(e) => setNewCargo({ ...newCargo, toLocation: e.target.value })}
                    className="w-full border rounded p-2"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold mb-1">Наименование груза</label>
                <input
                  type="text"
                  required
                  value={newCargo.cargoName}
                  onChange={(e) => setNewCargo({ ...newCargo, cargoName: e.target.value })}
                  className="w-full border rounded p-2"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold mb-1">Вес (Тонн)</label>
                  <input
                    type="number"
                    value={newCargo.weightTons}
                    onChange={(e) => setNewCargo({ ...newCargo, weightTons: e.target.value })}
                    className="w-full border rounded p-2"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1">Объем (м³)</label>
                  <input
                    type="number"
                    value={newCargo.volumeM3}
                    onChange={(e) => setNewCargo({ ...newCargo, volumeM3: e.target.value })}
                    className="w-full border rounded p-2"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1">Ставка (₽)</label>
                  <input
                    type="number"
                    value={newCargo.rateRub}
                    onChange={(e) => setNewCargo({ ...newCargo, rateRub: e.target.value })}
                    className="w-full border rounded p-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold mb-1">Грузоотправитель</label>
                  <input
                    type="text"
                    required
                    placeholder="ООO Компания"
                    value={newCargo.shipperName}
                    onChange={(e) => setNewCargo({ ...newCargo, shipperName: e.target.value })}
                    className="w-full border rounded p-2"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1">ИНН</label>
                  <input
                    type="text"
                    required
                    placeholder="7700000000"
                    value={newCargo.shipperInn}
                    onChange={(e) => setNewCargo({ ...newCargo, shipperInn: e.target.value })}
                    className="w-full border rounded p-2"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowAddCargoModal(false)}
                  className="px-4 py-2 text-slate-600 text-sm font-medium"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="bg-emerald-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-emerald-700"
                >
                  Опубликовать
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Add Transport */}
      {showAddTransportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 space-y-4 shadow-xl">
            <h3 className="font-bold text-lg text-slate-900 border-b pb-2">Добавление ТС на биржу</h3>
            <form onSubmit={handleAddTransport} className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold mb-1">Город где машина</label>
                  <input
                    type="text"
                    required
                    value={newTransport.currentLocation}
                    onChange={(e) => setNewTransport({ ...newTransport, currentLocation: e.target.value })}
                    className="w-full border rounded p-2"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1">Желаемое направление</label>
                  <input
                    type="text"
                    value={newTransport.destinationLocation}
                    onChange={(e) => setNewTransport({ ...newTransport, destinationLocation: e.target.value })}
                    className="w-full border rounded p-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold mb-1">Перевозчик (Компания)</label>
                  <input
                    type="text"
                    required
                    value={newTransport.carrierName}
                    onChange={(e) => setNewTransport({ ...newTransport, carrierName: e.target.value })}
                    className="w-full border rounded p-2"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1">ИНН</label>
                  <input
                    type="text"
                    required
                    value={newTransport.carrierInn}
                    onChange={(e) => setNewTransport({ ...newTransport, carrierInn: e.target.value })}
                    className="w-full border rounded p-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold mb-1">Водитель</label>
                  <input
                    type="text"
                    required
                    value={newTransport.driverName}
                    onChange={(e) => setNewTransport({ ...newTransport, driverName: e.target.value })}
                    className="w-full border rounded p-2"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1">Госномер ТС</label>
                  <input
                    type="text"
                    required
                    value={newTransport.truckRegNumber}
                    onChange={(e) => setNewTransport({ ...newTransport, truckRegNumber: e.target.value })}
                    className="w-full border rounded p-2"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowAddTransportModal(false)}
                  className="px-4 py-2 text-slate-600 text-sm font-medium"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700"
                >
                  Добавить ТС
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: New Order */}
      {showNewOrderModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 space-y-4 shadow-xl">
            <h3 className="font-bold text-lg text-slate-900 border-b pb-2">Сформировать Договор-Заявку</h3>
            <form onSubmit={handleCreateOrder} className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold mb-1">Заказчик</label>
                  <input
                    type="text"
                    value={newOrderForm.shipperName}
                    onChange={(e) => setNewOrderForm({ ...newOrderForm, shipperName: e.target.value })}
                    className="w-full border rounded p-2"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1">ИНН Заказчика</label>
                  <input
                    type="text"
                    value={newOrderForm.shipperInn}
                    onChange={(e) => setNewOrderForm({ ...newOrderForm, shipperInn: e.target.value })}
                    className="w-full border rounded p-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold mb-1">Перевозчик</label>
                  <input
                    type="text"
                    value={newOrderForm.carrierName}
                    onChange={(e) => setNewOrderForm({ ...newOrderForm, carrierName: e.target.value })}
                    className="w-full border rounded p-2"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1">Водитель</label>
                  <input
                    type="text"
                    value={newOrderForm.driverName}
                    onChange={(e) => setNewOrderForm({ ...newOrderForm, driverName: e.target.value })}
                    className="w-full border rounded p-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold mb-1">Ставка Заказчика (₽)</label>
                  <input
                    type="number"
                    value={newOrderForm.rateShipperRub}
                    onChange={(e) => setNewOrderForm({ ...newOrderForm, rateShipperRub: e.target.value })}
                    className="w-full border rounded p-2"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1">Ставка Перевозчику (₽)</label>
                  <input
                    type="number"
                    value={newOrderForm.rateCarrierRub}
                    onChange={(e) => setNewOrderForm({ ...newOrderForm, rateCarrierRub: e.target.value })}
                    className="w-full border rounded p-2"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowNewOrderModal(false)}
                  className="px-4 py-2 text-slate-600 text-sm font-medium"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="bg-purple-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-purple-700"
                >
                  Создать Заявку
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 text-xs py-4 border-t border-slate-800 mt-auto">
        <div className="max-w-7xl mx-auto px-4 text-center space-y-1">
          <div>© 2026 ATI.SU Clone — Автоматизированное рабочее место диспетчера-экспедитора грузоперевозок по России</div>
          <div className="text-slate-500">Интеграция норм погрузки труб (ППУ/Фасонка) • Расчет фрахта • Договоры-Заявки</div>
        </div>
      </footer>
    </div>
  );
}
