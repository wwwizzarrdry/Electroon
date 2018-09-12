const electron = require('electron');
const {Menu, Tray, ipcMain } = require('electron');
const nativeImage = require('electron').nativeImage;
const app = electron.app;
const BrowserWindow = electron.BrowserWindow;

let image = nativeImage.createFromPath(__dirname+'/assets/img/roon.png')

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let tray = null;
let contextMenu = null;
let splash = null;
let bgwin = null;
let win = null;

function createWindow () {
    let screenElectron = electron.screen;
    let mainScreen = screenElectron.getPrimaryDisplay();
    let allScreens = screenElectron.getAllDisplays();
    let dimensions = mainScreen.size;
    let posX = (dimensions.width - 350);
    let posY = (dimensions.height - 400);
    console.log("\n dimensions: " + dimensions.width + "x" + dimensions.height);

    // Create the browser window.
    win = new BrowserWindow({
        'node-integration': true,
        x: posX,
        y: posY,
        width: 350, 
        height: 365,
        alwaysOnTop: false,
        overlayScrollbars: true,
        show: false,
        transparent: true,
        frame: false,
        resizeable: false,
        skipTaskbar: true,
        maximizable: false,
        minimizable: false
    })

    // and load the index.html of the app.
    win.loadFile('index.html')
  
    // on first ready
    win.once('ready-to-show', () => {       
        setTimeout(function(){
            splash.close();
            win.show();
            win.focus();
            //win.webContents.openDevTools() // Open the DevTools.
        }, 2000)
    })

    win.on('show', () => {
        tray.setHighlightMode('always')
    })

    win.on('hide', () => {
        tray.setHighlightMode('never')
    })
    
    // Emitted when the window is closed.
    win.on('closed', () => {
        win = null
    })
}

// Splash screen
function createSplash() {
    // Show the splash screen
    splash = new BrowserWindow({
        'node-integration': true,
        position: "center",
        width: 150, 
        height: 150, 
        show: false,
        frame: false,  
        movable: false,
        alwaysOnTop: true,
        transparent: true,
        resizeable: false,
        skipTaskbar: true,
        maximizable: false,
        minimizable: false,
        focusable: false
    });
    
    splash.loadFile('splash.html')
    splash.show();
}
  
// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', () => {
    createSplash();
    createWindow();

    // Build tray icon
    tray = new Tray(image);
    contextMenu = Menu.buildFromTemplate([
        {
            label: 'Always On Top', 
            type: 'checkbox', 
            checked: win.isAlwaysOnTop(),
            click: function() {
                var alwaystop = win.isAlwaysOnTop() ? false : true;
                win.setAlwaysOnTop(alwaystop);
                this.checked = alwaystop;
            }
        },
        {
            label: 'Minimize', 
            type: 'checkbox', 
            checked: win.isMinimized(),
            click: function() {
                var minimized = win.isMinimized();
                (minimized) ? win.restore() : win.minimize();
                this.checked = !minimized;
                this.label = (minimized) ? 'Minimize' : 'Restore';
            }
        },
        {
            label: 'Force Reload', 
            type: 'normal', 
            click: function() {
                win.reload();
            }
        },
        {
            label: 'Inspect', 
            type: 'normal', 
            click: function(){
                win.toggleDevTools();
            }
        },
        {
            label: 'Quit', 
            type: 'normal',  
            click: function() {
                app.quit();
            }
        }
    ]);
    
    tray.setToolTip('Roon Mini-Controller');
    tray.setContextMenu(contextMenu);
    tray.on('click', () => {
        if(win.isVisible()) {
            win.hide();
        } else {
            win.show();
        } 
    });

    // Cross Window Comms
    ipcMain.on('nowPlaying', (event, arg) => {
        console.log(arg.zone)
        //console.log("ipcMain.on('nowPlaying', (event, arg)\n", "event: ", event, "arg: ", arg);
        //event.sender.send('nowPlaying', arg)
        //bgwin.webContents.send('nowPlaying', arg);
    })
})

// Quit when all windows are closed.
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
    }
})
  
app.on('activate', () => {
    if (win === null) {
        createWindow()
    }
})
