var RoonApi          = require("node-roon-api"),
    RoonApiStatus    = require("node-roon-api-status"),
    RoonApiTransport = require("node-roon-api-transport"),
    RoonApiImage     = require('node-roon-api-image'),
    RoonApiBrowse    = require('node-roon-api-browse'),
    Vue              = require('vue'),
    config           = require('./config/config.json'),
    debug = false;

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
        var roonstate = roon.load_config("roonstate");
        roonstate["display_name"] =  core.display_name;
        roonstate["display_version"] =  core.display_version;
        
        // Update model
        v.status = 'unauthorized';
        v.roonstate = roonstate;
        v.current_zone_id = roon.load_config("current_zone_id");

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
            roonstate:       null
        }
    }, 
    created: function(){
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
    },
    computed: {
        zone: function () {
            return this.zones[this.current_zone_id];
        }
    },
    watch: {
        'roonstate': function(val, oldval){
            config.roonstate = val;
            ipcRenderer.send('save_config', config);
        },
        'paired': function(val, oldval) {
            config.paired = val;
            save_config(config);
        },
        'current_zone_id': function(val, oldval) {
            roon.save_config("current_zone_id", val);
            this.first_run = false;
            config.current_zone_id = val;
            config.my_settings.first_run = false;
            save_config(config);
            refresh_browse();
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
function load_config(cfg) {
    ipcRenderer.send('load_config', cfg);
};

function save_config(cfg) {
    ipcRenderer.send('save_config', cfg); 
    roon.save_config("current_zone_id", cfg.current_zone_id);
};

function update_nowPlaying() {
    ipcRenderer.send('nowPlaying', v.zone);
}; 

function magicEigthBall() {
    return config.my_settings.eightball[Math.floor(Math.random() * (config.my_settings.eightball.length - 0 + 1)) + 0];
}

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
