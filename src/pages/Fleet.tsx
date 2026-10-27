import { useMemo, useState } from 'react'
import { DriverForm, VehicleForm } from '../forms'
import { useAuth } from '../auth'
import { activeTrip, latestFinishedTrip, openRepair, vehicleDuty } from '../fleetStatus'
import { dateRu, vehicleStatusLabel, vehicleStatuses, vehicleTone } from '../format'
import { useData } from '../store'
import type { Driver, Trip, Vehicle, VehicleStatus } from '../types'
import { Badge, ConfirmDialog, Drawer, Empty } from '../ui'

function vehicleNow(
  current: Trip | null,
  driverName: string | undefined,
  repair: string | undefined,
  duty: VehicleStatus,
  last: Trip | null,
) {
  if (current && (current.status === 'in_transit' || current.status === 'loading')) {
    return [current.number, `${current.from} — ${current.to}`, driverName].filter(Boolean).join(' · ')
  }
  if (duty === 'repair' && repair) return repair
  if (current?.status === 'planned') {
    return `План ${current.number} · ${dateRu(current.date)} · ${current.from} — ${current.to}`
  }
  if (last) return `Последний ${last.number} · ${dateRu(last.date)} · ${last.from} — ${last.to}`
  return 'Рейсов нет'
}

function driverNow(current: Trip | null, plate: string | undefined, last: Trip | null) {
  if (current && (current.status === 'in_transit' || current.status === 'loading')) {
    return [plate, current.number, `${current.from} — ${current.to}`].filter(Boolean).join(' · ')
  }
  if (current?.status === 'planned') {
    return ['План', plate, current.number, dateRu(current.date), `${current.from} — ${current.to}`].filter(Boolean).join(' · ')
  }
  if (last) return `Последний ${last.number} · ${dateRu(last.date)} · ${last.from} — ${last.to}`
  return 'Свободен'
}

export function FleetPage() {
  const { state, saveVehicle, deleteVehicle, saveDriver, deleteDriver } = useData()
  const { can } = useAuth()
  const allowed = can('fleet')
  const [vehicleEditor, setVehicleEditor] = useState<Vehicle | 'new' | null>(null)
  const [driverEditor, setDriverEditor] = useState<Driver | 'new' | null>(null)
  const [confirm, setConfirm] = useState<{ text: string; run: () => void } | null>(null)
  const [status, setStatus] = useState<VehicleStatus | 'all'>('all')
  const vehicles = useMemo(() => {
    return state.vehicles
      .map((vehicle) => ({ vehicle, duty: vehicleDuty(vehicle.status, state.trips, vehicle.id) }))
      .filter((row) => status === 'all' || row.duty === status)
  }, [state.vehicles, state.trips, status])

  return (
    <div className="stack">
      <section className="card">
        <div className="section-head">
          <h2>Машины</h2>
          <div className="fleet-tools">
            <label className="status-line">
              <span>Статус</span>
              <select value={status} onChange={(event) => setStatus(event.target.value as VehicleStatus | 'all')}>
                <option value="all">Все</option>
                {vehicleStatuses.map((item) => (
                  <option key={item} value={item}>
                    {vehicleStatusLabel[item]}
                  </option>
                ))}
              </select>
            </label>
            {allowed ? (
              <button type="button" className="btn small primary" onClick={() => setVehicleEditor('new')}>
                Добавить
              </button>
            ) : null}
          </div>
        </div>
        {state.vehicles.length === 0 ? (
          <Empty title="Парк пуст" />
        ) : vehicles.length === 0 ? (
          <Empty title="Таких машин нет" text="Смените фильтр статуса." />
        ) : (
          <div className="table-wrap">
            <table className="fleet-sheet">
              <thead>
                <tr>
                  <th>Номер</th>
                  <th>Тип</th>
                  <th>Модель</th>
                  <th>Статус</th>
                  <th>Сейчас</th>
                  {allowed ? <th className="fleet-action"><span className="sr">Действие</span></th> : null}
                </tr>
              </thead>
              <tbody>
                {vehicles.map(({ vehicle, duty }) => {
                  const trips = state.trips.filter((trip) => trip.vehicleId === vehicle.id)
                  const current = activeTrip(trips)
                  const driver = state.drivers.find((item) => item.id === current?.driverId)
                  const repair = openRepair(state.repairs.filter((job) => job.vehicleId === vehicle.id))
                  return (
                    <tr key={vehicle.id}>
                      <td>
                        <strong>{vehicle.plate}</strong>
                      </td>
                      <td>{vehicle.kind}</td>
                      <td>{vehicle.model}</td>
                      <td>
                        <Badge tone={vehicleTone(duty)}>{vehicleStatusLabel[duty]}</Badge>
                        {duty !== vehicle.status ? (
                          <span className="fleet-park">· парк: {vehicleStatusLabel[vehicle.status]}</span>
                        ) : null}
                      </td>
                      <td>{vehicleNow(current, driver?.name, repair?.description, duty, latestFinishedTrip(trips))}</td>
                      {allowed ? (
                        <td className="fleet-action">
                          <button type="button" className="text-btn" onClick={() => setVehicleEditor(vehicle)}>
                            Изменить
                          </button>
                        </td>
                      ) : null}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <section className="card">
        <div className="section-head">
          <h2>Водители</h2>
          {allowed ? (
            <button type="button" className="btn small primary" onClick={() => setDriverEditor('new')}>
              Добавить
            </button>
          ) : null}
        </div>
        {state.drivers.length === 0 ? (
          <Empty title="Водителей нет" />
        ) : (
          <div className="table-wrap">
            <table className="fleet-sheet">
              <thead>
                <tr>
                  <th>Водитель</th>
                  <th>Телефон</th>
                  <th>Сейчас</th>
                  {allowed ? <th className="fleet-action"><span className="sr">Действие</span></th> : null}
                </tr>
              </thead>
              <tbody>
                {state.drivers.map((driver) => {
                  const trips = state.trips.filter((trip) => trip.driverId === driver.id)
                  const current = activeTrip(trips)
                  const vehicle = state.vehicles.find((item) => item.id === current?.vehicleId)
                  return (
                    <tr key={driver.id}>
                      <td>
                        <strong>{driver.name}</strong>
                      </td>
                      <td>{driver.phone || '—'}</td>
                      <td>{driverNow(current, vehicle?.plate, latestFinishedTrip(trips))}</td>
                      {allowed ? (
                        <td className="fleet-action">
                          <button type="button" className="text-btn" onClick={() => setDriverEditor(driver)}>
                            Изменить
                          </button>
                        </td>
                      ) : null}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {vehicleEditor ? (
        <Drawer title={vehicleEditor === 'new' ? 'Новая машина' : 'Машина'} onClose={() => setVehicleEditor(null)}>
          <VehicleForm
            initial={vehicleEditor === 'new' ? undefined : vehicleEditor}
            onCancel={() => setVehicleEditor(null)}
            onSubmit={async (vehicle) => {
              if (await saveVehicle(vehicle)) setVehicleEditor(null)
            }}
            onDelete={
              vehicleEditor === 'new'
                ? undefined
                : () => {
                    const current = vehicleEditor
                    setConfirm({
                      text: `Удалить машину ${current.plate}?`,
                      run: () => {
                        void deleteVehicle(current.id).then((ok) => {
                          if (ok) setVehicleEditor(null)
                        })
                      },
                    })
                  }
            }
          />
        </Drawer>
      ) : null}
      {driverEditor ? (
        <Drawer title={driverEditor === 'new' ? 'Новый водитель' : 'Водитель'} onClose={() => setDriverEditor(null)}>
          <DriverForm
            initial={driverEditor === 'new' ? undefined : driverEditor}
            onCancel={() => setDriverEditor(null)}
            onSubmit={async (driver) => {
              if (await saveDriver(driver)) setDriverEditor(null)
            }}
            onDelete={
              driverEditor === 'new'
                ? undefined
                : () => {
                    const current = driverEditor
                    setConfirm({
                      text: `Удалить водителя ${current.name}?`,
                      run: () => {
                        void deleteDriver(current.id).then((ok) => {
                          if (ok) setDriverEditor(null)
                        })
                      },
                    })
                  }
            }
          />
        </Drawer>
      ) : null}
      {confirm ? (
        <ConfirmDialog
          text={confirm.text}
          confirmLabel="Удалить"
          onNo={() => setConfirm(null)}
          onYes={() => {
            confirm.run()
            setConfirm(null)
          }}
        />
      ) : null}
    </div>
  )
}
