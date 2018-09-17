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

// Player Window
function createWindow () {

    let screenElectron = electron.screen;
    let mainScreen = screenElectron.getPrimaryDisplay();
    let allScreens = screenElectron.getAllDisplays();
    let dimensions = mainScreen.size;
    let posX = (dimensions.width - 370);
    let posY = (dimensions.height - 404);

    // Load the previous state with fallback to defaults
    mainWindowState = new windowStateKeeper({
        path: 'winstate',
        file: 'window-state.json',
        defaultWidth: 370,
        defaultHeight: 365,
        defaultX: posX,
        defaultY: posY
    });
    
    if(debug) console.log("\nScreen Dimensions: " + dimensions.width + "x" + dimensions.height);

    // Create the browser window.
    win = new BrowserWindow({
        'node-integration': true,
        x: mainWindowState.x || mainWindowState.defaultX,
        y: mainWindowState.y || mainWindowState.defaultY,
        width: 380, 
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

// speed Dial Window
function createBGWindow() {

    let screenElectron = electron.screen;
    let mainScreen = screenElectron.getPrimaryDisplay();
    let allScreens = screenElectron.getAllDisplays();
    let dimensions = mainScreen.size;

    // Load the previous state with fallback to defaults
    bgWindowState = new windowStateKeeper({
        path: 'winstate',
        file: 'bg-window-state.json',
        defaultWidth: 800,
        defaultHeight: 500
    });

    bgwin = new BrowserWindow({
        'node-integration': true,
        darkTheme: config.my_settings.darkTheme,
        x: mainWindowState.x,
        y: mainWindowState.y,
        width: mainWindowState.width, 
        height: mainWindowState.height, 
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
  
app.on('ready', () => {
    createSplash();
    createWindow();
    //createBGWindow();

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
            label: "Change Player", 
            submenu: [
                {
                    label: "Roon", 
                    type: 'radio', 
                    checked: true,
                    click: (item, window, event) => {
                        tray.displayBalloon({
                            icon: icons["roon"],
                            title: 'Roon',
                            content: 'You switched to Roon'
                        });
                        tray.setTitle('Roon Player');
                        tray.setToolTip('Roon Player');
                        tray.setImage(icons["roon"])
                    }
                },
                {
                    label: "LastFM",
                    type: 'radio',  
                    click: (item, window, event) => {
                        tray.displayBalloon({
                            icon: icons["lastfm"],
                            title: 'LastFM',
                            content: 'You switched to LastFM'
                        });
                        tray.setTitle('LastFM Player');
                        tray.setToolTip('LastFM Player');
                        tray.setImage(icons["lastfm"])
                    }
                },
                {
                    label: "Plex", 
                    type: 'radio', 
                    click: (item, window, event) => {
                        tray.displayBalloon({
                            icon: icons["plex_img"],
                            title: 'Plex',
                            content: 'You switched to Plex'
                        });
                        tray.setTitle('Plex Player');
                        tray.setToolTip('Plex Player');
                        tray.setImage(icons["plex_img"])
                    }
                },
                {
                    label: "Sonos", 
                    type: 'radio', 
                    click: (item, window, event) => {
                        tray.displayBalloon({
                            icon: icons["sonos_img"],
                            title: 'Sonos',
                            content: 'You switched to Sonos'
                        });
                        tray.setTitle('Sonos Player');
                        tray.setToolTip('Sonos Player');
                        tray.setImage(icons["sonos_img"])
                    }
                }
            ]
        },
        {type: "separator"},
        {
            label  : "Position",
            submenu: [
                {
                    label: 'Free Range', 
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
    
    tray.on('click', (event) => {
        win.isVisible() ? win.hide() : win.show();
    });

    // Cross Window Comms
    ipcMain.on('nowPlaying', (event, arg) => {
        if(debug) console.log('\nnowPlaying')
        //event.sender.send('nowPlaying', arg)
    });

    // Save Config
    ipcMain.on('save_config', (event, arg) => {
        let data = JSON.stringify(arg, null, 4);
        fs.writeFile('config.json', data, function() {
            event.sender.send('config_saved', data);
            if(debug) console.log('######################\nconfig_saved: ' + process.cwd()+'\n', data);    
        });
    });

    // Load Config
    ipcMain.on('load_config', (event, arg) => {
        fs.readFileSync('config.json', function(data) {
            event.sender.send('config_loaded', data);
            if(debug) console.log('######################\nload_config:' +  process.cwd() + '\n', data);
        });
    });

    // Save Window Position
    ipcMain.on('save_position', (event, arg) => {
        if (win) mainWindowState.saveState(win);
        if (bgwin) bgWindowState.saveState(bgwin);
    });

    // Update Tray Title
    ipcMain.on('update-tray-title', function(event, title) {
        tray.setTitle(title);
    });
});


app.on('activate', () => {
    if (win === null) {
        createWindow()
    }
})

// Before Quit
app.on('before-quit', () => {
    console.log('before-quit: fired')
})

// Quit when all windows are closed.
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
    }
})

// Wil Quit - All windows closed, about to quit
app.on('will-quit', () => {
    console.log('will-quit: fired');
    tray = null;
    splash = null;
    bgwin = null;
    win = null;
})




// Other App Functions
function setWindowPosition(code){
    let screenElectron = electron.screen;
    let mainScreen = screenElectron.getPrimaryDisplay();
    let allScreens = screenElectron.getAllDisplays();
    let dimensions = mainScreen.size;
    let posX = (dimensions.width - 370);
    let posY = (dimensions.height - 400);
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

function setWindowDraggable(targetWindow, css_selector, enabled) {
    targetWindow.webContents.send('set_draggable', {
        css_selector: css_selector,
        enabled: enabled
    });
};

// Generate App Icons
function generateIcons() {

    // Registered Icons
    let roon_img = nativeImage.createFromPath(__dirname + '/assets/img/roon.png');
    let chromium_img = nativeImage.createFromPath(__dirname + '/assets/img/chromium.png');
    let gmusic_img = nativeImage.createFromPath(__dirname + '/assets/img/googlemusic.png');
    let lastfm_img = nativeImage.createFromPath(__dirname + '/assets/img/lastfm.png');
    let plex_img = nativeImage.createFromPath(__dirname + '/assets/img/plex.png');
    let sonos_img = nativeImage.createFromPath(__dirname + '/assets/img/sonos.png');
    let tidal_img = nativeImage.createFromPath(__dirname + '/assets/img/tidal.png');
    let youtube_img = nativeImage.createFromPath(__dirname + '/assets/img/youtube.png');
    let youtubemusic_img = nativeImage.createFromPath(__dirname + '/assets/img/youtubemusic.png');
    let spotify_img = nativeImage.createFromPath(__dirname + '/assets/img/spotify.png');
    let soundcloud_img = nativeImage.createFromPath(__dirname + '/assets/img/soundcloud.png');
    let pandora_img = nativeImage.createFromPath(__dirname + '/assets/img/pandora.png');

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
}