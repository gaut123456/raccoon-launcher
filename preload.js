const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
    getHypixelCount: () => ipcRenderer.invoke('get-hypixel-count'),
    launchMinecraft: (options) => ipcRenderer.invoke('launch-minecraft', options),
    onLaunchProgress: (callback) => ipcRenderer.on('launch-progress', callback),
    onMinecraftExit: (callback) => ipcRenderer.on('minecraft-exit', callback),
    minimizeWindow: () => ipcRenderer.send('minimize-window'),
    maximizeWindow: () => ipcRenderer.send('maximize-window'),
    closeWindow: () => ipcRenderer.send('close-window'),
    onLaunchComplete: (callback) => ipcRenderer.on('launch-complete', callback),
    onLaunchError: (callback) => ipcRenderer.on('launch-error', callback) // Add this line
})