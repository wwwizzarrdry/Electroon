var RoonApi          = require("node-roon-api"),
    RoonApiStatus    = require("node-roon-api-status"),
    RoonApiTransport = require("node-roon-api-transport"),
    RoonApiImage     = require('node-roon-api-image'),
    RoonApiBrowse    = require('node-roon-api-browse'),
    Vue              = require('vue'),
    defaultConfig    = require('./config/config.json'),
    config           = localStorage.getItem("config"),
    debug = false;

if (config == null) {
    localStorage.setItem("config", JSON.stringify(defaultConfig));
    config = defaultConfig;
} else {
    config = JSON.parse(config);
};
noImageFixSize();
if (config.my_settings.hide_dashboard) {
    ipcRenderer.send('update_context_menu', {
        label: 'Hide Dashboard',
        checked: true
    });
}
console.log('config', config)


// Initialize Services
var core, roonstate;
var roon = new RoonApi({

    extension_id:        'com.wwwizzarrdry.electroon',
    display_name:        'Electroon',
    display_version:     "1.0.0",
    publisher:           'wwwizzarrdry',
    email:               '',
    
    core_paired: function(core_) {
        core = core_;   
        var roonstate = config.roonstate;
        roonstate["display_name"] =  core.display_name;
        roonstate["display_version"] =  core.display_version;
        
        // Update model
        v.status = 'unauthorized';
        v.roonstate = roonstate;
        v.server_ip = config.server_ip;
        v.server_port = config.server_port;
        v.current_zone_id = config.current_zone_id;

        core.services.RoonApiTransport.subscribe_zones((response, msg) => {
            if (response == "Subscribed") { 
               let zones = msg.zones.reduce((p,e) => (p[e.zone_id] = e) && p, {});
               v.$set('zones', zones);
            } else if (response == "Changed") { 
                var z;
                if (msg.zones_removed) msg.zones_removed.forEach(e => delete(v.zones[e.zone_id]));
                if (msg.zones_added)   msg.zones_added  .forEach(e => v.zones[e.zone_id] = e);
                if (msg.zones_changed) msg.zones_changed.forEach(e => v.zones[e.zone_id] = e);
                v.$set('zones', v.zones);
            }
            v.paired = true;
        });

        v.status = 'connected';
        v.listoffset = 0;
        refresh_browse();
    },
    core_unpaired: function(core_) {
        core = undefined;
        v.status = 'disconnected';
        v.paired = false;
    }
});

// Initialize Services
var svc_status = new RoonApiStatus(roon);
roon.init_services({
    provided_services: [ svc_status ],
    required_services: [ RoonApiBrowse, RoonApiTransport, RoonApiImage ]
});
svc_status.set_status(magicEigthBall(), false);

// Initialize Vue Component
var wallpaperTimer = null;
var v = new Vue({
    el: "#roonapp",
    template: require('./player.html'),
    data: function() { 
        return {
            server_ip:       config.server_ip,
            server_port:     config.server_port,
            status:          'null',
            zones:           [],
            current_zone_id: null,
            listoffset:      0,
            list:            null,
            items:           [],
            paired:          false,
            roonstate:       null,
            view_settings:   false
        }
    }, 
    created: function(){
        getWindowDimensions();
        ipcRenderer.on('config_saved', (event, data) => {
            console.log('Config was saved!', data);
        });
        ipcRenderer.on('config_loaded', (event, data) => {
            console.log('Config was loaded!', data);
        });
        ipcRenderer.on('set_draggable', (event, data) => {
            if(data.enabled) {
                $(data.css_selector).addClass('draggable');               
            } else {
                $(data.css_selector).removeClass('draggable');
            }
        });
        ipcRenderer.on('transport_req', (event, data) => {
            console.log('\n\n\ntaskbar transport\n\n\n', data)
            switch(data.control) {
                case 'prev':
                    this.transport_previous();
                    break;
                case 'play':
                    this.transport_playpause();
                    break;
                case 'next':
                    this.transport_next();
                    break;
            }
        });
        ipcRenderer.on('open_settings', (event, data) => {
            this.view_settings = true;
        });
        ipcRenderer.on('window_dimensions', (event, data) => {
            config.my_settings.dimensions.width = data.width;
            config.my_settings.dimensions.height = data.height;
            console.log(data)
            console.log(config)
            roon.save_config('config', config);
        });
        ipcRenderer.on('toggle_dashboard', (event, data) => {
            $body.toggleClass('hide-dashboard');
            config.my_settings.hide_dashboard = $body.hasClass('hide-dashboard');
            roon.save_config('config', config);
        });
    },
    computed: {
        zone: function () {
            return this.zones[this.current_zone_id];
        }
    },
    watch: {
        'roonstate': function(val, oldval){
            config.roonstate = val;
            roon.save_config("config", config);
            //ipcRenderer.send('save_config', config);
        },
        'paired': function(val, oldval) {
            config.paired = val;
            roon.save_config("config", config);
        },
        'current_zone_id': function(val, oldval) {
            config.current_zone_id = val;
            config.my_settings.first_run = false;
            roon.save_config("config", config);
            refresh_browse();
        },
        'zones[current_zone_id].now_playing.three_line.line1': function(val, oldval) {
            var artistUrl,albumUrl,scale;
            // Save Artist Art
            if (v.zone.now_playing.artist_image_keys) {
                artistUrl = 'http://' + v.server_ip + ':' + v.server_port + '/api/image/' + v.zone.now_playing.artist_image_keys[0] + '?format=image/png&scale=fill&width='+ config.my_settings.dimensions.width +'&height=' + config.my_settings.dimensions.height;
            } else {
                artistUrl =  false;
            };
            
            if (v.zone.now_playing.image_key) {
                scale = (config.my_settings.dimensions.height * 0.33).toFixed(0);
                albumUrl = 'http://' + v.server_ip + ':' + v.server_port + '/api/image/' + v.zone.now_playing.image_key + '?format=image/png&scale=fill&width='+ scale +'&height='+ scale;
            } else {
                albumUrl =  false;
            };

            var artistOptions = {
                directory: "art/",
                filename: 'artist.png'
            };

            var albumOptions = {
                directory: "art/",
                filename: 'album.png'
            };
            
            if(artistUrl && albumUrl) {
                download(artistUrl, artistOptions, function(err){
                    if (err) { throw err };
                    download(albumUrl, albumOptions, function(err){
                        if (err) { throw err };
                        createWallpaper([artistUrl, albumUrl]);
                    })
                })
            } else if (artistUrl && !albumUrl) {
                download(artistUrl, artistOptions, function(err){
                    if (err) {throw err};
                    createWallpaper([artistUrl, albumUrl]);
                })
            } else if (!artistUrl && albumUrl) {
                download(albumUrl, albumOptions, function(err){
                    if (err) { throw err };
                    createWallpaper([artistUrl, albumUrl]);
                })
            } else {
                createWallpaper([artistUrl, albumUrl]);
            }
        }
    },
    methods: {
        change_server_ip: function(event){
            this.server_ip = $(event.target).val();
        },
        change_server_port: function(event){
            this.server_port = $(event.target).val();
        },
        update_settings: function(val, oldval){
            config.server_ip = this.server_ip;
            config.server_port = this.server_port;
            roon.save_config("config", config);  
            this.view_settings = false;
            ipcRenderer.send('rebuild_app', {
                restart: true
            });
        },
        cancel_settings: function(event){
            this.server_ip = config.server_ip;
            this.server_port = config.server_port;
            this.view_settings = false;
        },
        to_time: function (s) {
            let r = "";
            if (s >= 3600) {           
                r += Math.floor(s / 3600).toString() + ":"; s = s % 3600; 
            }

            if (!r || s >= 600) {
                r += Math.floor(s / 60).toString() + ":"; 
                s = s % 60;  
            } else {
                r += "0"; 
                r += Math.floor(s / 60).toString() + ":"; 
                s = s % 60;   
            }

            if (s >= 10) {
                r += s.toString();
                s = -1;
            } else if (s >= 0) { 
                r += "0"; r += s.toString();
                s = -1;
            }
            return r;
        },
        transport_change_settings: function(val) {            
            if (val == "shuffle") {
                this.zone.settings.shuffle = !this.zone.settings.shuffle;
                $('.shuffle').find('i').removeClass('uk-text-primary md-color-white')
                .addClass((this.zone.settings.shuffle ? 'uk-text-primary' : 'md-color-white'));

            } else if (val == "auto_radio") {
                this.zone.settings.auto_radio = !this.zone.settings.auto_radio;
                $('.radio').find('i').removeClass('uk-text-primary md-color-white')
                .addClass((this.zone.settings.auto_radio ? 'uk-text-primary' : 'md-color-white'));

            } else if (val == "loop") {
                this.zone.settings.loop = 'disabled'; // aint nobody got time for more loops...
            };

            core.services.RoonApiTransport.change_settings(this.zone, this.zone.settings, function(err){
                console.log("Transport Error:\ncore.services.RoonApiTransport.change_settings()", err)
            });
        },         
        transport_playpause: function() {
            core.services.RoonApiTransport.control(this.zone, 'playpause');
        },
        transport_stop: function() {
            core.services.RoonApiTransport.control(this.zone, 'stop');
        },
        transport_previous: function() {
            core.services.RoonApiTransport.control(this.zone, 'previous');
        },
        transport_next: function() {
            core.services.RoonApiTransport.control(this.zone, 'next');
        },
        hover_show_seek_time: function(event){
            var w = $(document).width() - 23,
                x = event.pageX - 12,
                x_perc = (x/w),
                duration = this.zone.now_playing.length,
                seek_pos = (duration * x_perc).toFixed(0),
                smart_pos = (event.pageX < (w*0.5) ) ? (x + 8) : (x - 45);
            if (seek_pos > duration) seek_pos = duration;
            if (seek_pos < 0) seek_pos = 0;
            $(".time-rail-seek").attr("data-seek", this.to_time(seek_pos)).css("left", smart_pos + "px");
        },
        hover_hide_seek_time: function(event){
            $(".time-rail-seek").attr("data-seek", "").css("left", "10px");
        },
        transport_seek: function(event) {      
            var w = $(document).width() - 23,
                x = event.pageX - 12,
                x_perc = (x/w),
                duration = this.zone.now_playing.length,
                seek_pos = (duration * x_perc).toFixed(0);
                
            if (seek_pos > duration) seek_pos = duration;
            if (seek_pos < 0) seek_pos = 0;
            core.services.RoonApiTransport.seek(this.zone, 'absolute', seek_pos, (result) => {
                console.log("RoonApiTransport.seek", result);
            });
        },
        transport_volume: function(el) {
            var outs = this.zone.outputs; 
            for(i=0;i<outs.length;i++){
                core.services.RoonApiTransport.change_volume(outs[i].output_id, "absolute", $(el.target).val())
            }
        },
        show_volume: function(el) {
            // To-Do: Replace with range slider
            if($(".volume-input").is(":visible")) {
                $(".volume-input").slideToggle()
            } else {
                var outs = this.zone.outputs, avg = 0;            
                // Normalize All Zone Volumes 
                for(i=0;i<outs.length;i++){
                    avg += outs[i].volume.value;
                }
                $(".volume-input").val((avg/outs.length).toFixed(0)).slideToggle().select().focus();
            }
        },
        list_item: function(item) {
            if (!item.input_prompt) {
                refresh_browse({ item_key: item.item_key });
            }
        },
        list_input: function(item) {
            let val = (item.input_prompt.value || "").trim();
            if (val === "") return;
            if (item.input_prompt) {
                refresh_browse({ item_key: item.item_key, input: val });
            }
        },
        list_back: function() {
            refresh_browse({ pop_levels: 1 });
        },
        list_home: function() {
            refresh_browse({ pop_all: true });
        },
        list_refresh: function() {
            refresh_browse({ refresh_list: true } );
        },
        list_next_page: function() {
            load_browse(this.listoffset + 100);
        },
        list_prev_page: function() {
            load_browse(this.listoffset - 100);
        },
        toggleList: function(){
            $(".list, .lists").toggleClass("active");
        },
        toggleTrackAlbumTitle: function(){
            $(".line1, .line2").toggleClass("uk-hidden");
        }
    }
});

// Utility Functions
function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
};

function load_config(cfg) {
    ipcRenderer.send('load_config', cfg);
};

function save_config(cfg) {
    ipcRenderer.send('save_config', cfg); 
    roon.save_config("current_zone_id", cfg.current_zone_id);
};

function getWindowDimensions() {
    console.log('getWindowDimensions()')
    ipcRenderer.send('get_dimensions', {});
};

function update_nowPlaying() {
    ipcRenderer.send('nowPlaying', v.zone);
}; 

// Image and Canvas Helpers
function createWallpaper(arr) {
    var infoTxt    = "";
    var artist     = (arr[0]) ? 'config/art/artist.png' : 'config/art/noartist.png';
    var album      = (arr[1]) ? 'config/art/album.png' : 'config/art/noalbum.png'; 
    var _y         = (config.my_settings.dimensions.height*0.66).toFixed(0) - 80;
    var txtCanvasX = (config.my_settings.dimensions.height*0.33 + 50).toFixed(0);

    // ##  Create text to png (line1 <track>, line3 <album>, line2 <artist>)
    var canvas       = document.createElement('canvas');
    var ctx          = canvas.getContext("2d");
    var canvasWidth  = ((config.my_settings.dimensions.width - 50) - (config.my_settings.dimensions.height*0.33)).toFixed(0);
    var canvasHeight = (config.my_settings.dimensions.height*0.33).toFixed(0);
    canvas.width     = canvasWidth;
    canvas.height    = canvasHeight; 

    // Set background color
    ctx.beginPath();
    ctx.rect(0, 0, canvasWidth, canvasHeight);
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fill();

    // Track
    ctx.font      = "60px Qicksand, Arial, sans-serif";
    ctx.fillStyle = "white";
    infoTxt       = truncateCanvasText(ctx, v.zone.now_playing.three_line.line1, canvasWidth - 50);
    ctx.fillText(infoTxt,30,90);
    
    // Album
    ctx.font      = "40px Qicksand, Arial, sans-serif";
    ctx.fillStyle = "#e0e0e0";
    infoTxt       = truncateCanvasText(ctx, v.zone.now_playing.three_line.line3, canvasWidth - 50);
    ctx.fillText(infoTxt,30,160);
    
    // Artist
    ctx.font      = "30px Qicksand, Arial, sans-serif";
    ctx.fillStyle = "#e0e0e0";
    infoTxt       = truncateCanvasText(ctx, v.zone.now_playing.three_line.line2, canvasWidth - 50);
    ctx.fillText(infoTxt,30,200);

    // Convert Canvas => DataURI => PNG
    var b64 = canvas.toDataURL("image/png");
    ImageDataURI.outputFile(b64, 'art/three_line.png').then(txtInfo => {
        // ## Combine all images into one wallpaper
            setTimeout(function(){
                mergeImages([
                    { src: artist, opacity: 1, x: 0, y: 0 }, 
                    { src: album, opacity: 1, x: 50, y: _y }, 
                    { src: 'config/art/three_line.png', opacity: 1, x: txtCanvasX, y: _y }
                ], {
                    width: config.my_settings.dimensions.width,
                    height: config.my_settings.dimensions.height
                }).then(wall => {
                    ImageDataURI.outputFile(wall, 'art/wallpaper.png').then(res => {    
                        console.log("\n\nwallpaper: ", res);
                        if (wallpaperTimer) {
                            clearTimeout(wallpaperTimer)
                        };
                        wallpaperTimer = setTimeout(function(){
                            ipcRenderer.send('nowPlaying', v.zone);
                        }, 4000)
                    });
                });
            }, 1000)
        
    });
};

function noImageFixSize(){
    var canvas = document.createElement('canvas');
    var ctx = canvas.getContext("2d");
    var b64, canvasWidth, canvasHeight;
    
    // ## 1.
    // Fix No Artist Image (default_noartist.png => noartist.png)
    canvasWidth     = (config.my_settings.dimensions.width).toFixed(0);
    canvasHeight    = (config.my_settings.dimensions.height).toFixed(0);
    canvas.width    = canvasWidth;
    canvas.height   = canvasHeight;
    makeImg('config/art/default_noartist.png');


    function makeImg(src) {
        var base_image = new Image();
        base_image.src = src;
        base_image.onload = function(){
            //ctx.drawImage(base_image, 0, 0);
            ctx.drawImage(
                base_image, 0, 0, base_image.width, base_image.height, // source rectangle
                0, 0, canvas.width, canvas.height // destination rectangle
            ); 

            b64 = canvas.toDataURL("image/png");
            if (src == 'config/art/default_noartist.png') {
                ImageDataURI.outputFile(b64, 'art/noartist.png').then(noartist => {
                    console.log("noartist.png ready");
                    // ## 2.
                    // Fix No Album Image (default_noalbum.png => noalbum.png)
                    canvasWidth     = (config.my_settings.dimensions.height*0.33).toFixed(0);
                    canvasHeight    = (config.my_settings.dimensions.height*0.33).toFixed(0);
                    canvas.width    = canvasWidth;
                    canvas.height   = canvasHeight;
                    makeImg('config/art/default_noalbum.png');
                });
            } else {
                ImageDataURI.outputFile(b64, 'art/noalbum.png').then(noalbum => {
                    console.log("noalbum.png ready")
                });
            }
        }
    };
};

function truncateCanvasText(ctx, str, maxWidth) {
    var width = ctx.measureText(str).width;
    var ellipsis = '…';
    var ellipsisWidth = ctx.measureText(ellipsis).width;
    if (width<=maxWidth || width<=ellipsisWidth) {
        return str;
    } else {
        var len = str.length;
        while (width>=maxWidth-ellipsisWidth && len-->0) {
            str = str.substring(0, len);
            width = ctx.measureText(str).width;
        }
        return str+ellipsis;
    }
};

// Roon Helper Functions
function magicEigthBall() {
    return config.my_settings.eightball[Math.floor(Math.random() * (config.my_settings.eightball.length - 0 + 1)) + 0];
};

function refresh_browse(opts) {
    opts = Object.assign({
        hierarchy:          "browse",
        zone_or_output_id:  v.current_zone_id,
    }, opts);

    core.services.RoonApiBrowse.browse(opts, (err, r) => {
        if (err) { console.log("Error: RoonApiBrowse", err, r); return; }

        console.log(err, r);

        if (r.action == 'list') {
            v.$set("list", r.list);
            v.$set("items", []);
            var listoffset = r.list.display_offset > 0 ? r.list.display_offset : 0;
            load_browse(listoffset);

        } else if (r.action == 'message') {
            alert((r.is_error ? "ERROR: " : "") + r.message);

        } else if (r.action == 'replace_item') {
            var i = 0;
            var l = v.items;
            while (i < l.length) {
                if (l[i].item_key == opts.item_key) {
                    l.splice(i, 1, r.item);
                    break;
                }
                i++;
            }
            v.$set("items", l);

        } else if (r.action == 'remove_item') {
            var i = 0;
            var l = v.items;
            while (i < l.length) {
                if (l[i].item_key == opts.item_key) {
                    l.splice(i, 1);
                    break;
                }
                i++;
            }
            v.$set("items", l);
        }
    });
};

function load_browse(listoffset) {
    core.services.RoonApiBrowse.load({
        hierarchy: "browse",
        offset: listoffset,
        set_display_offset: listoffset,
    }, (err, r) => {
        v.$set("listoffset", listoffset);
        v.$set("items", r.items);
    });
};

var go = function() {
    v.status = 'connecting';
    roon.connect_to_host(v.server_ip, v.server_port, v.server_port, (e) => {
        console.log("connect_to_host", e);
        if(e) {
            v.status = 'disconnected';
        } 
        setTimeout(go, 3000)
    });
};
go();
