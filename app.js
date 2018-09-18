const fs                     = require('fs');
var config                   = require('./config/config.json');
const windowStateKeeper      = require('electron-window-state');
const electron               = require('electron');
const {Menu, Tray, ipcMain } = require('electron');
const nativeImage            = require('electron').nativeImage;
const app                    = electron.app;
const BrowserWindow          = electron.BrowserWindow;

var mainWindowState          = null;
var bgWindowState            = null;
var icons                    = generateIcons();
let debug                    = config.my_settings.debug;

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let splash = null;
let bgwin = null;
let win = null;
let tray = null;
let contextMenu = null;

// Set DPI Scaling
//app.commandLine.appendSwitch('high-dpi-support', 'true');
//app.commandLine.appendSwitch('force-device-scale-factor', '1.5');

// Change to working directory
try {
    process.chdir(process.cwd()+'/config');
    if (debug) {
        console.log('\nNew working directory:\n' + process.cwd());
        testFsModule();
    }
} catch (err) {
    console.error(`chdir: ${err}`);
}

var screenElectron, mainScreen, allScreens, dimensions, posX, posY, last_dimension;
// Player Window
function createWindow () {
    // Set initial window state params
    loadDimensions();

    // Load the previous state with fallback to defaults
    mainWindowState = windowStateKeeper({
        path: 'winstate',
        file: 'window-state.json',
        defaultWidth: 500,
        defaultHeight: 550,
        defaultX: posX,
        defaultY: posY
    });
    
    // Create the browser window.
    win = new BrowserWindow({
        'node-integration': true,
        x: mainWindowState.x || mainWindowState.defaultX,
        y: mainWindowState.y || mainWindowState.defaultY,
        width: mainWindowState.width || 365, 
        height: mainWindowState.height || 350,
        alwaysOnTop: false,
        overlayScrollbars: true,
        show: false,
        transparent: true,
        frame: false,
        resizeable: false,
        skipTaskbar: true,
        maximizable: false,
        minimizable: false
    });

    win.setMinimumSize(350, 150);
    win.setMaximumSize(dimensions.width, dimensions.height)
    mainWindowState.manage(win);

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
        mainWindowState.saveState(win);
        app.quit();
        win = null;
        bgwin = null;
        tray = null;
    })
};

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
};

// Webview Window
function createBGWindow() {
    loadDimensions();
    // Load the previous state with fallback to defaults
    bgWindowState = windowStateKeeper({
        path: 'winstate',
        file: 'bg-window-state.json',
        defaultWidth: 800,
        defaultHeight: 500
    });

    bgwin = new BrowserWindow({
        'node-integration': false,
        darkTheme: config.my_settings.darkTheme,
        x: bgWindowState.x || null,
        y: bgWindowState.y || null,
        width: mainWindowState.width || bgWindowState.defaultWidth, 
        height: mainWindowState.height || bgWindowState.defaultHeight, 
        alwaysOnTop: false,
        overlayScrollbars: true,
        show: true,
        transparent: false,
        frame: true,
        resizeable: true,
        skipTaskbar: false,
        maximizable: true,
        minimizable: true
    });

    bgWindowState.manage(bgwin);

    // and load the index.html of the app.
    bgwin.loadFile('webview.html');

    bgwin.on('ready-to-show', () => {
        bgwin.setIcon(chromium_img);
        bgwin.setAutoHideMenuBar(true);
        bgwin.setMenuBarVisibility(false);
    })

    bgwin.on('show', () => {
        bgwin.focus()
    })
    
    bgwin.on('closed', () => {
        bgwin = null;
    })
};
  

// Default dimensions
function loadDimensions() {
    let winSize = (win) ? win.getSize() : [350, 350];
    screenElectron = electron.screen;
    mainScreen = screenElectron.getPrimaryDisplay();
    allScreens = screenElectron.getAllDisplays();
    dimensions = mainScreen.size;
    posX = (dimensions.width - winSize[0]);
    posY = (dimensions.height - winSize[1]);
};

// Auto Position Window
function setWindowPosition(code){
    loadDimensions();
    switch(code) {
        case "TL":
            win.setPosition(0, 0, true);
            break;
        case "TR":
            win.setPosition(posX, 0, true);
            break;
        case "BR":
            win.setPosition(posX, posY, true);
            break;
        case "BL":
            win.setPosition(0, posY, true);
            break;
    }
    win.show();
    mainWindowState.saveState(win);
};

// Enable Dragging Window
function setWindowDraggable(targetWindow, css_selector, enabled) {
    targetWindow.webContents.send('set_draggable', {
        css_selector: css_selector,
        enabled: enabled
    });
};

// Generate App Icons
var roon_img, google_img, chromium_img, gmusic_img, lastfm_img, plex_img, sonos_img, tidal_img, youtube_img, youtubemusic_img, spotify_img, soundcloud_img, pandora_img, amazon_img, apple_img;
function generateIcons() {
    // Registered Icons
    roon_img = nativeImage.createFromPath(__dirname + '/assets/img/roon.png');
    google_img = nativeImage.createFromPath(__dirname + '/assets/img/google.png');
    chromium_img = nativeImage.createFromPath(__dirname + '/assets/img/chromium.png');
    gmusic_img = nativeImage.createFromPath(__dirname + '/assets/img/googlemusic.png');
    lastfm_img = nativeImage.createFromPath(__dirname + '/assets/img/lastfm.png');
    plex_img = nativeImage.createFromPath(__dirname + '/assets/img/plex.png');
    sonos_img = nativeImage.createFromPath(__dirname + '/assets/img/sonos.png');
    tidal_img = nativeImage.createFromPath(__dirname + '/assets/img/tidal.png');
    youtube_img = nativeImage.createFromPath(__dirname + '/assets/img/youtube.png');
    youtubemusic_img = nativeImage.createFromPath(__dirname + '/assets/img/youtubemusic.png');
    spotify_img = nativeImage.createFromPath(__dirname + '/assets/img/spotify.png');
    soundcloud_img = nativeImage.createFromPath(__dirname + '/assets/img/soundcloud.png');
    pandora_img = nativeImage.createFromPath(__dirname + '/assets/img/pandora.png');
    amazon_img = nativeImage.createFromPath(__dirname + '/assets/img/amazonprime.png');
    apple_img = nativeImage.createFromPath(__dirname + '/assets/img/applemusic.png');

    return {
        "chromium": chromium_img,
        "roon": roon_img,
        "googlemusic": gmusic_img,
        "lastfm": lastfm_img,
        "plex": plex_img,
        "sonos": sonos_img,
        "tidal": tidal_img,
        "youtube": youtube_img,
        "youtubemusic": youtubemusic_img,
        "spotify": spotify_img,
        "soundcloud": soundcloud_img,
        "pandora": pandora_img
    }
}; 

function testFsModule() {
    // Debug FS
    try { 
        var t = new Date;
        fs.mkdir('tests', function() {
            fs.writeFile('tests/fs-write-test.txt', 'Command: fs.writeFile();\nResult: Success!\nTimestamp: ' + t + '\nWorking Directory: ' + process.cwd(), function() {
                fs.readFile('tests/fs-write-test.txt', 'utf-8', function(err, data) {
                    if(err) {
                        console.log(err)
                    } else {
                        console.log(process.cwd(), data);
                    }
                });
            });
        });
    } catch(err) { 
        console.log(err);
    }
};

app.on('ready', () => {
    createSplash();
    createWindow();

    // Build tray icon
    tray = new Tray(icons["roon"]);
    
    contextMenu = Menu.buildFromTemplate([
        {
            label: "Speed Dial", 
            type: "normal",
            click: function() {
                if(bgwin != null) {
                    bgwin.show();
                } else {
                    createBGWindow();
                }
            }
        },        
        {type: "separator"},
        {
            label  : "Position",
            submenu: [
                {
                    label: 'Free Roam', 
                    type: 'normal', 
                    click:function() {
                        setWindowDraggable(win, "#drag", true);
                    }
                },
                {type: "separator"},
                {
                    label: 'Top Left', 
                    type: 'normal', 
                    click: function() {
                        setWindowPosition("TL")
                    }
                },
                {
                    label: 'Top Right', 
                    type: 'normal', 
                    click: function() {
                        setWindowPosition("TR")
                    }
                },
                {
                    label: 'Bottom Right', 
                    type: 'normal', 
                    checked: true,
                    click:function() {
                        setWindowPosition("BR")
                    }
                },
                {
                    label: 'Bottom Left', 
                    type: 'normal', 
                    click:function() {
                        setWindowPosition("BL")
                    }
                }
            ]
        },
        {type: "separator"},
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
            label  : "More...",
            submenu: [
                {
                    label: 'Maximize', 
                    type: 'checkbox', 
                    click: function(){ 
                        var curSize = win.getSize();
                        var maxSize = win.getMaximumSize();
                        if(curSize.reduce((a,b)=>a*b) >= maxSize.reduce((a,b)=>a*b)) {
                            win.setSize(last_dimension.size[0], last_dimension.size[1]);
                            win.setPosition(last_dimension.pos[0], last_dimension.pos[1], 1000);
                            mainWindowState.saveState(win);
                        } else {
                            last_dimension = {
                                size: win.getSize(),
                                pos: win.getPosition()
                            };
                            win.setSize(maxSize[0], maxSize[1]);
                            win.setPosition(0, 1, true);
                            mainWindowState.saveState(win);
                        }
                    }
                },
                {
                    label: 'Show in Taskbar', 
                    type: 'checkbox', 
                    click: function(){
                        win.skipTaskbar() ? win.setSkipTaskbar(false) : win.setSkipTaskbar(true);
                    }
                },
                {
                    label: 'Inspect', 
                    type: 'normal', 
                    click: function(){
                        win.toggleDevTools();
                    }
                },
            ]
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
    
    tray.on('click', (event) => {
        win.isVisible() ? win.hide() : win.show();
    });

    // Get current zone details
    ipcMain.on('nowPlaying', (event, arg) => {
        console.log('\nnowPlaying', arg);
        tray.setTitle(arg.now_playing.three_line.line1);
        //event.sender.send('nowPlaying', arg)
    });

    // Save Config
    ipcMain.on('save_config', (event, arg) => {
        let data = JSON.stringify(arg, null, 4);
        fs.writeFile('config.json', data, function() {
            event.sender.send('config_saved', data);
        });
    });

    // Load Config
    ipcMain.on('load_config', (event, arg) => {
        fs.readFileSync('config.json', function(data) {
            event.sender.send('config_loaded', data);
        });
    });

    // Save Window Position
    ipcMain.on('save_position', (event, arg) => {
        if (win) mainWindowState.saveState(win);
        if (bgwin) bgWindowState.saveState(bgwin);
    });
});


app.on('activate', () => {
    if (win === null) {
        createWindow()
    }
});

// Before Quit
app.on('before-quit', () => {
    console.log('before-quit: fired')
});

// Quit when all windows are closed.
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
    }
});

// Wil Quit - All windows closed, about to quit
app.on('will-quit', () => {
    console.log('will-quit: fired');
    tray = null;
    splash = null;
    bgwin = null;
    win = null;
});