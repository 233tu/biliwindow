const { app, BrowserWindow, globalShortcut, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process'); 

let win;
let settingsWin; 
const configPath = path.join(app.getPath('userData'), 'window-state.json');

// --- 👇 核心：鼠标侧键外挂脚本引擎 👇 ---
function startMouseHelper() {
  const ahkPath = path.join(app.getPath('userData'), 'mouse-helper.ahk');
  
  // 重新优化的 AHK 脚本：修复了括号匹配并精简了逻辑
  const ahkContent = `
#NoEnv
#SingleInstance Force

pid := ${process.pid}

SetTimer, CheckAlive, 2000
return

CheckAlive:
Process, Exist, %pid%
if (ErrorLevel = 0) 
{
    ExitApp
}
return

; 鼠标侧键映射
XButton1::Send {F14}
XButton2::Send {F13}
`;

  // 写入文件
  fs.writeFileSync(ahkPath, ahkContent);

  // 启动脚本
  exec('start "" "' + ahkPath + '"');
  
  console.log("🖱️ 鼠标侧键辅助引擎已修复并重新启动！");
}
// --- 👆 核心代码结束 👆 ---


function loadState() {
  let defaultState = { 
    url: 'https://www.bilibili.com', 
    bounds: { width: 800, height: 450 },
    opacity: 1.0,
    shortcuts: { play: 'Alt+P', forward: 'Alt+Right' }
  };
  try {
    if (fs.existsSync(configPath)) {
      const savedState = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      return { ...defaultState, ...savedState, shortcuts: { ...defaultState.shortcuts, ...(savedState.shortcuts || {}) } };
    }
  } catch (err) {}
  return defaultState;
}

let state = loadState(); 
let isGameMode = false; 

function saveConfig() {
  if (win && !win.isDestroyed()) {
    state.url = win.webContents.getURL();
    state.bounds = win.getBounds();
    state.opacity = win.getOpacity();
  }
  fs.writeFileSync(configPath, JSON.stringify(state));
}

function registerAllShortcuts() {
  globalShortcut.unregisterAll(); 

  globalShortcut.register('CommandOrControl+S', openSettings);
  globalShortcut.register('CommandOrControl+Shift+L', () => {
    isGameMode = !isGameMode;
    if (win) win.setIgnoreMouseEvents(isGameMode); 
  });
  globalShortcut.register('Alt+Up', () => {
    if (win) { win.setOpacity(Math.min(1.0, win.getOpacity() + 0.1)); saveConfig(); }
  });
  globalShortcut.register('Alt+Down', () => {
    if (win) { win.setOpacity(Math.max(0.2, win.getOpacity() - 0.1)); saveConfig(); }
  });

  // 永久绑定幽灵键 F13 和 F14
  globalShortcut.register('F13', () => {
    if (win) win.webContents.send('video-action', 'toggle');
  });
  globalShortcut.register('F14', () => {
    if (win) win.webContents.send('video-action', 'forward');
  });

  try {
    globalShortcut.register(state.shortcuts.play, () => {
      if (win) win.webContents.send('video-action', 'toggle');
    });
    globalShortcut.register(state.shortcuts.forward, () => {
      if (win) win.webContents.send('video-action', 'forward');
    });
  } catch (error) {
    console.log("⚠️ 快捷键注册发生异常:", error);
  }
}

function createWindow() {
  win = new BrowserWindow({
    ...state.bounds, 
    opacity: state.opacity,
    alwaysOnTop: true, 
    frame: false,      
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true
    }
  });

  win.webContents.setWindowOpenHandler((details) => {
    win.loadURL(details.url);
    return { action: 'deny' };
  });

  win.loadURL(state.url);

  let saveTimeout;
  const scheduleSave = () => {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(saveConfig, 500);
  };

  win.on('move', scheduleSave);
  win.on('resize', scheduleSave);
  win.webContents.on('did-navigate', scheduleSave);
  win.webContents.on('did-navigate-in-page', scheduleSave);
}

function openSettings() {
  if (settingsWin) {
    settingsWin.focus();
    return;
  }
  settingsWin = new BrowserWindow({
    width: 450,
    height: 350,
    alwaysOnTop: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true
    }
  });
  settingsWin.loadFile('settings.html');
  settingsWin.on('closed', () => {
    settingsWin = null;
  });
}

app.whenReady().then(() => {
  createWindow();
  registerAllShortcuts(); 
  
  // 🌟 在软件启动时，自动召唤鼠标辅助引擎！
  startMouseHelper();

  ipcMain.on('update-shortcuts', (event, newKeys) => {
    state.shortcuts.play = newKeys.play;
    state.shortcuts.forward = newKeys.forward;
    registerAllShortcuts();
    saveConfig();
    if (settingsWin) settingsWin.close(); 
  });
});

app.on('window-all-closed', () => {
  app.quit();
});