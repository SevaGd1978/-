import { useState } from 'react'
import { DriverForm, VehicleForm } from '../forms'
import { useAuth } from '../auth'
import { useData } from '../store'
import type { Driver, Vehicle } from '../types'
import { ConfirmDialog, Drawer, Empty } from '../ui'

export function FleetPage() {
  const { state, saveVehicle, deleteVehicle, saveDriver, deleteDriver } = useData()
  const { can } = useAuth()
  const allowed = can('fleet')
  const [vehicleEditor, setVehicleEditor] = useState<Vehicle | 'new' | null>(null)
  const [driverEditor, setDriverEditor] = useState<Driver | 'new' | null>(null)
  const [confirm, setConfirm] = useState<{ text: string; run: () => void } | null>(null)

  return (
    <div className="split">
      <section className="card">
        <div className="section-head">
          <h2>Машины</h2>
          {allowed ? (
            <button type="button" className="btn small primary" onClick={() => setVehicleEditor('new')}>
              Добавить
            </button>
          ) : null}
        </div>
        {state.vehicles.length === 0 ? (
          <Empty title="Парк пуст" />
        ) : (
          <ul className="fleet-list">
            {state.vehicles.map((vehicle) => (
              <li key={vehicle.id}>
                <div>
                  <strong>{vehicle.plate}</strong>
                  <small className="muted">
                    {vehicle.kind} · {vehicle.model}
                  </small>
                </div>
                {allowed ? (
                  <button type="button" className="text-btn" onClick={() => setVehicleEditor(vehicle)}>
                    Изменить
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
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
          <ul className="fleet-list">
            {state.drivers.map((driver) => (
              <li key={driver.id}>
                <div>
                  <strong>{driver.name}</strong>
                  <small className="muted">{driver.phone || 'Телефон не указан'}</small>
                </div>
                {allowed ? (
                  <button type="button" className="text-btn" onClick={() => setDriverEditor(driver)}>
                    Изменить
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
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
