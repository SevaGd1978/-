const { app, BrowserWindow, shell } = require('electron')
const path = require('node:path')
const { createPutevoyDesktopServer, DEFAULT_UPSTREAM } = require('./proxy.cjs')

const upstream = process.env.PUTEVOY_SERVER || DEFAULT_UPSTREAM

function createWindow(localUrl) {
  const window = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 960,
    minHeight: 640,
    title: 'Путевой',
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'icon.ico'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  const localOrigin = new URL(localUrl).origin
  window.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
  window.webContents.on('will-navigate', (event, url) => {
    if (url.startsWith(localOrigin)) return
    event.preventDefault()
    shell.openExternal(url)
  })
  window.loadURL(localUrl)
  return window
}

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  let desktop = null
  app.whenReady().then(async () => {
    app.setAppUserModelId('tech.amvera.putevoy')
    desktop = createPutevoyDesktopServer({
      staticDir: path.join(__dirname, '..', 'dist'),
      upstream,
    })
    const localUrl = await desktop.listen()
    const window = createWindow(localUrl)
    app.on('second-instance', () => {
      if (window.isMinimized()) window.restore()
      window.focus()
    })
  })
  app.on('window-all-closed', () => {
    if (desktop) desktop.close()
    app.quit()
  })
}
