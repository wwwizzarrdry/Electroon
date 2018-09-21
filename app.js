//const fs                     = require('fs');
const fs                     = require('fs-extra');
const windowStateKeeper      = require('electron-window-state');
const electron               = require('electron');
const {Menu, Tray, ipcMain } = require('electron');
const nativeImage            = require('electron').nativeImage;
const path                   = require('path');
const nrc                    = require('node-run-cmd');
const wallpaper              = require('wallpaper');
const app                    = electron.app;
const BrowserWindow          = electron.BrowserWindow;
var mainWindowState          = null;
var bgWindowState            = null;
var icons                    = generateIcons();
let debug                    = false;

let splash = null;
let bgwin = null;
let win = null;
let tray = null;
let contextMenu = null;

const originalWallpaper = saveOriginalWallpaper();


// Set DPI Scaling
//app.commandLine.appendSwitch('high-dpi-support', 'true');
//app.commandLine.appendSwitch('force-device-scale-factor', '1.5');

console.log(app.getAppPath());
console.log(__dirname);

// Change to working directory
try {
    process.chdir(process.cwd()+'/config');
    console.log('\nNew working directory:\n' + process.cwd());
    // Test FS Module
    testFsModule();
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
        skipTaskbar: false,
        maximizable: false,
        minimizable: false,
        icon: icons.roon
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
            setTaskbarBtn()
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

// Create Taskbar Buttons
function setTaskbarBtn() {
    win.setThumbarButtons([]);
    win.setThumbarButtons([
        {
          tooltip: 'Previous Track',
          icon: path.resolve(`${__dirname}/assets/img/previous.png`),
          click: function() {
              win.webContents.send('transport_req', {control: 'prev'})
          }
        },
        {
          tooltip: 'Play',
          icon: path.resolve(`${__dirname}/assets/img/play.png`),
          click: function() {
              win.webContents.send('transport_req', {control: 'play'})
          }
        },
        {
          tooltip: 'Next Track',
          icon: path.resolve(`${__dirname}/assets/img/next.png`),
          click: function() {
              win.webContents.send('transport_req', {control: 'next'})
          }
        }
      ]);
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

// Save Original Wallpaper
function saveOriginalWallpaper() {
    wallpaper.get().then(imagePath => {
        console.log("\n\nSave Original Wallpaper: " + imagePath);
        // Copy Current Wallpaper
        fs.copy(imagePath, './art/originalWallpaper.png')
        .then(() => console.log('originalWallpaper copied: success!'))
        .catch(err => console.error(err))
    });
};

// Get current wallpaper
function getWallpaper() {
    wallpaper.get().then(imagePath => {
        return imagePath;
    });
};

// Set current wallpaper
function setWallpaper(imagePath, setImmediate) {
    wallpaper.set(imagePath).then(() => {
        console.log('\n\nNew wallpaper: ' + imagePath);
    });
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
    let template = [
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
                    label: 'FullScreen', 
                    type: 'checkbox', 
                    click: function(){ 
                        (win.isFullScreen()) ? win.setFullScreen(false) : win.setFullScreen(true);
                    }
                },
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
                    label: 'Hide Dashboard', 
                    type: 'checkbox', 
                    checked: false,
                    click: function(){ 
                        win.webContents.send('toggle_dashboard', {});
                        this.checked = !this.checked;
                    }
                },
                {
                    label: 'Relaunch', 
                    type: 'checkbox', 
                    click: function(){
                        app.relaunch({args: process.argv.slice(1).concat(['--relaunch'])})
                        app.exit(0)
                    }
                },
                {
                    label: 'Settings', 
                    type: 'normal', 
                    click: function(){
                        win.webContents.send('open_settings', {});   
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
    ];

    contextMenu = Menu.buildFromTemplate(template);
    tray.setToolTip('Roon Mini-Controller');
    tray.setContextMenu(contextMenu);
    tray.on('click', (event) => {
        win.isMinimized() ? win.restore() && setTaskbarBtn() : win.minimize();
    });


    // Get current zone details
    ipcMain.on('nowPlaying', (event, arg) => {
        console.log('\nnowPlaying', arg);
        
        // Update Taskbar overlay icon
        var img = nativeImage.createFromPath('./art/album.png');
        tray.setToolTip(arg.now_playing.three_line.line1 + ' - ' +  arg.now_playing.three_line.line2);
        win.setOverlayIcon(img, 'Now Playing');
        
        // Set Wallpaper
        setWallpaper('./art/wallpaper.png');
    });

    // Get Dimensions
    ipcMain.on('get_dimensions', (event, arg) => {
        win.webContents.send('window_dimensions', dimensions);
    });

    // Save Window Position
    ipcMain.on('save_position', (event, arg) => {
        if (win) mainWindowState.saveState(win);
        if (bgwin) bgWindowState.saveState(bgwin);
    });

    // Rebuild roon_bundle.js
    ipcMain.on('rebuild_app', (event, arg) => {
        nrc.run('npm run buld').then(function(exitCodes) {
           console.log(exitCodes)
           setTimeout(function(){
               app.relaunch({args: process.argv.slice(1).concat(['--relaunch'])})
               app.exit(0)
           }, 5000)       
      }, function(err) {
        console.log('Command failed to run with error: ', err);
      });
    });

    // Restart
    ipcMain.on('restart_app', (event, arg) => {
        app.relaunch({args: process.argv.slice(1).concat(['--relaunch'])})
        app.exit(0)
    });

    // Upde context menu
    ipcMain.on('update_context_menu', (event, arg) => {
        template[5].submenu[2].checked = arg.checked
        contextMenu = Menu.buildFromTemplate(template);
        tray.setContextMenu(contextMenu);
        win.webContents.send('toggle_dashboard', {});
    })
    
});


app.on('activate', () => {
    if (win === null) {
        createWindow()
    }
});

// Before Quit
app.on('before-quit', () => {
    console.log('before-quit: fired');
    // Restore Original Wallpaper before exiting
    setWallpaper('./art/originalWallpaper.png', 'setImmediate');
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