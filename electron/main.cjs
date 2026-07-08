// Electron main process. Loads the built game (dist/index.html) as a
// desktop app, or the live Vite dev server when ELECTRON_START_URL is set
// (see the "electron:dev" script in package.json).
const { app, BrowserWindow, shell } = require('electron')
const path = require('node:path')

const isDev = !!process.env.ELECTRON_START_URL

function createWindow()
{
    const win = new BrowserWindow({
        width: 1280,
        height: 800,
        backgroundColor: '#0b0b12',
        title: 'Circuit City',
        icon: path.join(__dirname, '..', 'static', 'favicons', 'favicon.svg'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.cjs'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
        },
    })

    win.removeMenu()

    // Keep external links (Discord, socials, credits) opening in the
    // system browser instead of navigating the game window away.
    win.webContents.setWindowOpenHandler(({ url }) =>
    {
        shell.openExternal(url)
        return { action: 'deny' }
    })

    if(isDev)
        win.loadURL(process.env.ELECTRON_START_URL)
    else
        win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
}

app.whenReady().then(() =>
{
    createWindow()

    app.on('activate', () =>
    {
        if(BrowserWindow.getAllWindows().length === 0)
            createWindow()
    })
})

app.on('window-all-closed', () =>
{
    if(process.platform !== 'darwin')
        app.quit()
})
