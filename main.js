const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('node:path');
const https = require('node:https');
const { Client, Authenticator } = require('minecraft-launcher-core');
const { Auth } = require("msmc");
let mainWindow;
const launcher = new Client();

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        minWidth: 800,
        minHeight: 600,
        frame: false,
        webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            preload: path.join(__dirname, 'preload.js'),
            contentSecurityPolicy: "default-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com"
        }
    });

    mainWindow.loadFile('index.html');
    mainWindow.maximize();
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

ipcMain.handle('get-hypixel-count', async () => {
    return new Promise((resolve, reject) => {
        https.get('https://api.mcsrvstat.us/2/hypixel.net', (resp) => {
            let data = '';
            resp.on('data', (chunk) => { data += chunk; });
            resp.on('end', () => {
                try {
                    const jsonData = JSON.parse(data);
                    resolve(jsonData.players.online);
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', (err) => {
            reject(err);
        });
    });
});

ipcMain.handle('launch-minecraft', async (event, opts) => {

    const authManager = new Auth("select_account");
    const xboxManager = await authManager.launch("raw");
    const token = await xboxManager.getMinecraft();
    const options = {
        ...opts,
        authorization: token.mclc(),
        root: "./minecraft",
        javaPath: path.join(__dirname, "java", "bin", "java"),
    };

    launcher.launch(options);

    launcher.on('progress', (e) => {
        mainWindow.webContents.send('launch-progress', e);
    });

    launcher.on('data', (e) => {
        console.log(e);
    });

    launcher.on('close', () => {
        mainWindow.webContents.send('minecraft-exit');
    });
});

launcher.on('debug', (e) => console.log(e));
launcher.on('data', (e) => console.log(e));

ipcMain.on('minimize-window', () => {
    mainWindow.minimize();
});

ipcMain.on('maximize-window', () => {
    if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
    } else {
        mainWindow.maximize();
    }
});

ipcMain.on('close-window', () => {
    mainWindow.close();
});