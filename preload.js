const { contextBridge, ipcRenderer } = require('electron');

// 1. 用于控制视频的逻辑（原有的）
ipcRenderer.on('video-action', (event, action) => {
  const video = document.querySelector('video');
  if (!video) return;

  if (action === 'toggle') video.paused ? video.play() : video.pause();
  else if (action === 'forward') video.currentTime += 5;
});

// 2. 新增：为主窗口和设置窗口搭建一座“安全通信桥梁”
contextBridge.exposeInMainWorld('electronAPI', {
  // 当设置页面的“保存”按钮被点击时，触发这个通道发送数据给主进程
  updateShortcuts: (newKeys) => ipcRenderer.send('update-shortcuts', newKeys)
});