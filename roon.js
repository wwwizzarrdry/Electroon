var RoonApi          = require("node-roon-api"),
    RoonApiStatus    = require("node-roon-api-status"),
    RoonApiTransport = require("node-roon-api-transport"),
    RoonApiImage     = require('node-roon-api-image'),
    RoonApiBrowse    = require('node-roon-api-browse'),
    Vue              = require('vue'),
    config           = require('./config/config.json');

let debug = config.my_settings.debug;

var core, roonstate;
var roon = new RoonApi({

    extension_id:        'com.wwwizzarrdry.electroon',
    display_name:        'Electroon',
    display_version:     "1.0.0",
    publisher:           'wwwizzarrdry',
    email:               '',
    
    core_paired: function(core_) {
        core = core_;   
        var roonstate = roon.load_config("roonstate");
        roonstate["display_name"] =  core.display_name;
        roonstate["display_version"] =  core.display_version;
        
        // Update model
        v.status = 'unauthorized';
        v.roonstate = roonstate;
        v.current_zone_id = roon.load_config("current_zone_id");

        core.services.RoonApiTransport.subscribe_zones((response, msg) => {
           if (response == "Subscribed") { 
               // Subscribe to Zone
               let zones = msg.zones.reduce((p,e) => (p[e.zone_id] = e) && p, {});
               v.$set('zones', zones);
            } else if (response == "Changed") { 
                // Changed Zone
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

var svc_status = new RoonApiStatus(roon);
roon.init_services({
    provided_services: [ svc_status ],
    required_services: [ RoonApiBrowse, RoonApiTransport, RoonApiImage ]
});
svc_status.set_status(config.my_settings.eightball[Math.floor(Math.random() * (config.my_settings.eightball.length - 0 + 1)) + 0], false);


//Vue.config.devtools = true;
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
            first_run:       true,
            album_img:       null,
            artist_img:      null,
            roonstate:       null
        }
    }, 
    created: function(){
        ipcRenderer.on('config_saved', (event, data) => {
            //if(debug) console.log('######################\nConfig was saved!', data);
        });
        ipcRenderer.on('config_loaded', (event, data) => {
            //if(debug) console.log('######################\nConfig was loaded!', data);
        });
        ipcRenderer.on('set_draggable', (event, data) => {
            if(debug) console.log('######################\nset_draggable', data);
            if(data.enabled) {
                $(data.css_selector).addClass('draggable');               
            } else {
                $(data.css_selector).removeClass('draggable');
            }
        });
    },
    computed: {
        zone: function () {
            return this.zones[this.current_zone_id];
        },
        artist_img: function() {
            if(this.zones[this.current_zone_id].now_playing.artist_image_keys) {
                return 'http://' + this.server_ip + ':' + this.server_port + '/api/image/' + this.zones[this.current_zone_id].now_playing.artist_image_keys[0] + '?scale=fit&width=1920&height=1080';
            } else {
                return 'assets/img/noimage.jpg';
            }
        },
        album_img: function() {
            if(this.zones[this.current_zone_id].now_playing.image_key){
                return 'http://' + this.server_ip + ':' + this.server_port + '/api/image/' + this.zones[this.current_zone_id].now_playing.image_key + '?scale=fit&width=1920&height=1080';return 'http://' + this.server_ip + ':' + this.server_port + '/api/image/' + this.zones[this.current_zone_id].now_playing.image_key + '?scale=fit&width=1920&height=1080';
            } else {
                return 'assets/img/noimage.jpg';
            }
            
        },
        history: function() {
            return config.my_settings.history;
        },
        conf: function() {
            return config;
        }
    },
    watch: {
        'roonstate': function(val, oldval){
            config.roonstate = val;
            ipcRenderer.send('save_config', config);
            console.log("roonstate updated", val);
        },
        'paired': function(val, oldval) {
            config.paired = val;
            save_config(config);
            refresh_browse();
        },
        'current_zone_id': function(val, oldval) {
            roon.save_config("current_zone_id", val);
            this.first_run = false;
            config.current_zone_id = val;
            config.my_settings.first_run = false;
            save_config(config);
            refresh_browse();
        },
        'zones[current_zone_id].now_playing.image_key': function() {
            update_now_playing(this);
            update_history(config);
        }
    },
    methods: {
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
            var x_perc = ( (event.pageX - 10) / $(".time-rail").width()),
                duration = this.zone.now_playing.length,
                seek_pos = (duration * x_perc).toFixed(),
                smart_pos = (event.pageX < 320) ? (event.pageX + 8) : (event.pageX - 35);
            $(".time-rail-seek").attr("data-seek", this.to_time(seek_pos)).css("left", smart_pos + "px");
        },
        hover_hide_seek_time: function(event){
            $(".time-rail-seek").attr("data-seek", "").css("left", "10px");
        },
        transport_seek: function(event) {      
            var x_perc = ( (event.pageX - 10) / $(".time-rail").width()),
                duration = this.zone.now_playing.length,
                seek_pos = (duration * x_perc).toFixed();
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
        },
        randID_generator: function () {
            var randLetter = String.fromCharCode(65 + Math.floor(Math.random() * 36));
            return randLetter + Date.now();
        },
        hex2rgba: function (hex,opacity){
            opacity = (opacity > 1) ? (opacity/100).toFixed(2) : opacity; 
            hex = hex.replace('#','');
            r = parseInt(hex.substring(0,2), 16);
            g = parseInt(hex.substring(2,4), 16);
            b = parseInt(hex.substring(4,6), 16);
    
            result = 'rgba('+r+','+g+','+b+','+opacity+')';
            return result;
        }
    }
});

function load_config(cfg) {
    ipcRenderer.send('load_config', cfg);
};

function save_config(cfg) {
    ipcRenderer.send('save_config', cfg); 
    roon.save_config("current_zone_id", cfg.current_zone_id);
};

function update_tray_title(title) {
    ipcRenderer.send('update-tray-title', title);
};

function update_now_playing() {
    if(v.zones[v.current_zone_id].now_playing.artist_image_keys) {
        v.artist_img = 'http://' + v.server_ip + ':' + v.server_port + '/api/image/' + v.zones[v.current_zone_id].now_playing.artist_image_keys[0] + '?scale=fit&width=1920&height=1080';
    } else {
        v.artist_img = 'assets/img/noimage.jpg';
    }
    if(v.zones[v.current_zone_id].now_playing.image_key){
        v.album_img = 'http://' + v.server_ip + ':' + v.server_port + '/api/image/' + v.zones[v.current_zone_id].now_playing.image_key + '?scale=fit&width=1920&height=1080'; 
    } else {
        v.album_img = 'assets/img/noimage.jpg';
    }
    var data = {
        "artist_img": v.artist_img,
        "album_img": v.album_img,
        "zone": v.zone
    };
    console.log("update_now_playing()", data)
    ipcRenderer.send('nowPlaying', data);
}; 

function update_history(cfg) {
    // Update the history array
    var ts = new Date;

    // Update the image keys
    if(v.zones[v.current_zone_id].now_playing.artist_image_keys) {
        cfg.my_settings.last_artist_key = v.zones[v.current_zone_id].now_playing.artist_image_keys[0];
    } else {
        cfg.my_settings.last_artist_key = 'assets/img/noimage.jpg';
    }
    if(v.zones[v.current_zone_id].now_playing.image_key){
        cfg.my_settings.last_album_key = v.zones[v.current_zone_id].now_playing.image_key; 
    } else {
        cfg.my_settings.last_artist_key = 'assets/img/noimage.jpg';
    }
    

    // Keep 100 tracks
    if (cfg.my_settings.history.length == 100) {
        cfg.my_settings.history.shift(0);   
    };

    if (cfg.my_settings.history.length && cfg.my_settings.history.pop().line1 == v.zones[v.current_zone_id].now_playing.three_line.line1) {
        cfg.my_settings.history[cfg.my_settings.history.length - 1].timestamp = ts.valueOf(); 
    } else {
        cfg.my_settings.history.push({            
            "timestamp": ts.valueOf(),
            "profile": cfg.my_settings.profile,
            "line1": v.zones[v.current_zone_id].now_playing.three_line.line1,
            "line2": v.zones[v.current_zone_id].now_playing.three_line.line2,
            "line3": v.zones[v.current_zone_id].now_playing.three_line.line3,
            "artist_img": v.artist_img,
            "album_img": v.album_img
        });
    }

    ipcRenderer.send('save_config', cfg);
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
