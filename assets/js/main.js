"use strict";

const dataKeys = {
    REQ: "req",
    ARG: "arg",
    CELL: "cell",
    RULE: "rule",
    COUNT: "count",
    RET: "ret"
};

const reqKeys = {
    ECHO:"ECHO",
    INITCELL:"INITCELL",
    INITRULE:"INITRULE",
    UPDATE:"UPDATECELL"
};

var reqOnMessages = {};
reqOnMessages[reqKeys.ECHO] = onmsg_echo;
reqOnMessages[reqKeys.INITCELL] = onmsg_initcell;
reqOnMessages[reqKeys.INITRULE] = onmsg_initrule;
reqOnMessages[reqKeys.UPDATE] = onmsg_update;

const colorlist = ["#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd", "#8c564b", "#e377c2", "#7f7f7f", "#bcbd22", "#17becf", "#1f77b4", "#aec7e8", "#ff7f0e", "#ffbb78", "#2ca02c", "#98df8a", "#d62728", "#ff9896", "#9467bd", "#c5b0d5", "#8c564b", "#c49c94", "#e377c2", "#f7b6d2", "#7f7f7f", "#c7c7c7", "#bcbd22", "#dbdb8d", "#17becf", "#9edae5", "#3182bd", "#6baed6", "#9ecae1", "#c6dbef", "#e6550d", "#fd8d3c", "#fdae6b", "#fdd0a2", "#31a354", "#74c476", "#a1d99b", "#c7e9c0", "#756bb1", "#9e9ac8", "#bcbddc", "#dadaeb", "#636363", "#969696", "#bdbdbd", "#d9d9d9"];

window.onload = function() {
    if (window.File) {
        $("#load_rulefile")[0].addEventListener("change", function(e){load_from_file(e,init_rule)}, false);
        $("#load_cellfile")[0].addEventListener("change", function(e){load_from_file(e,init_cell)}, false);
        text_host_changed();
    } else {
        window.alert("File API is not found.");
    }
    logmsg("Ready...");
}

var interval = 100;
var timer = null;
var sockerr_flg = false;
var timerrun_flg = false;
var ws = null;
var w=20;
var h=20;
var size_cell=12;
var size_cell_rule=18;
var colormap = {};
var cellData = [];
var ruleData = {};
var view_cell;
var view_rule;

function text_host_changed()
{
    if($("#text_host").val().length==0)
    {
        $("#button_toggle").attr("disabled","disabled");
    }
    else
    {
        $("#button_toggle").removeAttr("disabled");
    }
}

function logmsg(msgstr)
{
    var str = $("#text_log").val();
    $("#text_log").val(str+"\n"+msgstr);
    $("#text_log").scrollTop($("#text_log").prop('scrollHeight'));
}

function connect()
{
    if (ws==null)
    {
        logmsg("Connecting...");
        ws = new WebSocket("ws://"+$("#text_host").val());

        ws.onmessage = function(msg) {
            // console.debug("on message");

            // parse received message
            var d = JSON.parse(msg.data);

            // get request key
            var k = d[dataKeys.REQ];

            // get result
            var ret = d[dataKeys.RET];

            if(ret){
                reqOnMessages[k](d);
            }
            else{
                logmsg("The request is not processed correctly.");
            }
        };

        ws.onopen = function (event) {
            // console.debug("socket opened");
            // log message
            logmsg("Connected to "+$("#text_host").val());

            // enable buttons
            $("#button_toggle").html("Close");
            $("#button_toggle").removeAttr("disabled");
            button_enable();
        };

        ws.onerror = function (event) {
            // console.debug("socket error");

            logmsg("Socket error.");
            sockerr_flg=true;
        };

        ws.onclose = function (event) {
            // console.debug("disconnected");

            if (!sockerr_flg)
            {
                logmsg("Closed.");
            }
            sockerr_flg = false;

            // enable buttons
            $("#button_toggle").html("Connect");
            $("#button_toggle").removeAttr("disabled");
            button_disable();

            ws = null;
        };
    }
    else{
        logmsg("Closing...");
        ws.close();
    }
}

function onmsg_echo(d)
{
    console.debug(d);
}

function onmsg_initrule(d)
{
    // console.debug("recv initrule");
    logmsg(" " + d.arg.rule.N + " rules, " + d.arg.rule.states.length + " states.");
    update_rule_view(d.arg.rule.dict);
}

function onmsg_initcell(d)
{
    // console.debug("recv initcell");
    var arg = d[dataKeys.ARG];
    set_celldata(arg[dataKeys.CELL]);
    init_cell_view();
}

function onmsg_update(d)
{
    // console.debug("recv update");
    var arg = d[dataKeys.ARG];
    set_celldata(arg[dataKeys.CELL]);
    update_cell_view();
}

function set_celldata(cell)
{
    w = cell.length;
    h = cell[1].length;
    for(var x=0; x<w; x++)
    {
        for(var y=0; y<h; y++)
        {
            var i = y*w+x;
            cellData[i] = cell[x][y];
        }
    }
}

function idx2pos(i)
{
    var x = i%w;
    var y = Math.floor(i/w);
    return [x,y];
}


function btn_onclick()
{
    // console.debug("button clicked");
    $("#button_toggle").attr("disabled","disabled");
    connect();
}

function pack_req(req, d)
{
    var data = {};
    data[dataKeys.REQ] = req;
    data[dataKeys.ARG] = d;
    return JSON.stringify(data);
}

function gen_arg(name, d)
{
    var data = {};
    data[name] = d;
    return data;
}

function send_data(msg)
{
    if(ws==null | ws.readyState != ws.OPEN)
    {
        stop_timer();
        $("#button_update_run").text("Run")
    }
    else{
        ws.send(msg);
    }
}

function init_cell(d, name)
{
    logmsg("Cell file: \""+ name + "\"");
    var msg = gen_cell_from_str(d);
    send_data(msg);
}

function init_rule(d, name)
{
    logmsg("Rule file: \""+ name + "\"");
    var msg = gen_rule_from_str(d);
    send_data(msg);
}

function gen_rule_from_str(d)
{
    var data = d.split("\n");
    var arg = gen_arg(dataKeys.RULE, data);
    var msg = pack_req(reqKeys.INITRULE, arg);
    return msg;
}

function gen_cell_from_str(d)
{
    var data = d.split("\n");
    data = data.map(function(v){return v.split(" ");});
    data.some(function(v,idx){
            v.some(function(el, idx){
                    if (el.length!=4) v.splice(idx,1);
                    })
            if(v.length==0) data.splice(idx,1);
            });

    // transpose
    var tdata = data[0].map(function(col, i) { 
            return data.map(function(row) { 
                    return row[i] 
                    })
            });
    var arg = gen_arg(dataKeys.CELL, tdata);
    var msg = pack_req(reqKeys.INITCELL, arg);
    return msg;
}

function update_step_onclick()
{
    update_step();
}

function update_run_onclick()
{
    if (!timerrun_flg)
    {
        start_timer();
        $("#button_update_run").text("Stop")
    }
    else{
        stop_timer();
        $("#button_update_run").text("Run")
    }
}

function button_disable()
{
    $("#load_rulefile").attr("disabled", true);
    $("#load_cellfile").attr("disabled", true);
    $("#button_update_step").attr("disabled", true);
    $("#button_update_run").attr("disabled", true);
}

function button_enable()
{
    $("#load_rulefile").removeAttr("disabled");
    $("#load_cellfile").removeAttr("disabled");
    $("#button_update_step").removeAttr("disabled");
    $("#button_update_run").removeAttr("disabled");
}

function start_timer() {
    // console.debug("start constant update");
    timer = setInterval("update_step()",interval);
    timerrun_flg = true;
}

function stop_timer()
{
    // console.debug("stop constant update");
    clearInterval(timer);
    timerrun_flg = false;
}

function gen_update_data(count)
{
    var arg = gen_arg(dataKeys.COUNT, count);
    var msg = pack_req(reqKeys.UPDATE, arg);
    return msg;
}

function update_step()
{
    var cnt = parseInt($("#update_step").val());
    var msg = gen_update_data(cnt);
    send_data(msg);
}

function get_color(val, key)
{
    var v = 0;
    switch(key)
    {
        case "north":
            v = (val>>24);
            break;
        case "east":
            v = (val>>16)&0xff;
            break;
        case "south":
            v = (val>>8)&0xff;
            break;
        case "west":
            v = val&0xff;
            break;
    }
    if (v in colormap)
    {
        return colormap[v];
    }
    else
    {
        if (Object.keys(colormap).length < colorlist.length)
        {
            colormap[v] = colorlist[Object.keys(colormap).length];
        }
        else
        {
            colormap[v] = d3.rgb(Math.random()*255,Math.random()*255,Math.random()*255);
        }
        return colormap[v];
    }
}


function update_cell_view()
{
    var size_dot=size_cell/6;

    for(var ds of [{a:0.5,b:1/6,k:"north"},{a:0.5,b:5/6, k:"south"}, {a:1/6,b:0.5,k:"east"},{a:5/6,b:0.5,k:"west"}])
    {
        var obj = view_cell.select(".cells_"+ds.k).selectAll("circle").data(cellData);

        obj.transition()
            .duration(0)
            .attr("fill", function(d){return get_color(d,ds.k);});
    }
}

function init_cell_view()
{ 
    var size_dot=size_cell/6;

    d3.select("#cellview").select("svg").remove();
    view_cell = d3.select("#cellview").append("svg");

    view_cell
        .attr("width", w*size_cell)
        .attr("height", h*size_cell);

    view_cell.append("g").attr("class","cells");
    view_cell.append("g").attr("class","cells_north");
    view_cell.append("g").attr("class","cells_south");
    view_cell.append("g").attr("class","cells_east");
    view_cell.append("g").attr("class","cells_west");

    var obj = view_cell.select(".cells").selectAll("rect").data(cellData);

    obj.enter().append("rect")
        .attr("transform",function(d,i){
                var pos = idx2pos(i);
                return "translate("+ pos[0]*size_cell +","+ pos[1]*size_cell + ")";
                })
        .attr("stroke", "black")
        .attr("fill", "#dddddd")
        .attr("width", size_cell)
        .attr("height", size_cell);

    for(var ds of [{a:0.5,b:1/6,k:"north"},{a:0.5,b:5/6, k:"south"}, {a:1/6,b:0.5,k:"east"},{a:5/6,b:0.5,k:"west"}])
    {
        obj = view_cell.select(".cells_"+ds.k).selectAll("circle").data(cellData);

        obj.enter().append("circle")
            .attr("transform",function(d,i){
                    var pos = idx2pos(i);
                    return "translate("+ pos[0]*size_cell +","+ pos[1]*size_cell + ")";
                    })
        .attr("cx", size_cell*ds.a)  
            .attr("cy", size_cell*ds.b)
            .attr("r", size_dot)
            .attr("fill", function(d){return get_color(d,ds.k);});

    }
}

function update_rule_view(d)
{ 
    var size_dot=size_cell_rule/6;

    d3.select("#ruleview").selectAll("div").remove();
    
    view_rule =  d3.select("#ruleview");

    for(var k of Object.keys(d))
    {
        var v = d[k];
        var si = d[k][0];
        var so = d[k][1];
        var ei = d[k][2];
        var eo = d[k][3];

        var obj = view_rule.append("div").attr("class","col-xs-1").append("svg")
            .attr("stroke", "black")
            .attr("width", size_cell_rule*4)
            .attr("height", size_dot*12);

        obj.append("rect")
            .attr("stroke", "none")
            .attr("fill", "#eeeeee")
            .attr("width", size_cell_rule*4)
            .attr("height", size_dot*12);

        var obja = obj.append("g")
            .attr("transform",function(d,i){
                    return "translate(" + size_dot*3+","+size_dot*3+")";
                    });

        obja.append("rect")
            .attr("stroke", "black")
            .attr("fill", "#dddddd")
            .attr("width", size_cell_rule)
            .attr("height", size_cell_rule);

        for(var ds of [{a:0.5,b:1/6,k:"north"},{a:0.5,b:5/6, k:"south"}, {a:1/6,b:0.5,k:"east"},{a:5/6,b:0.5,k:"west"}])
        {
            obja.append("circle")
            .attr("cx", size_cell_rule*ds.a)  
                .attr("cy", size_cell_rule*ds.b)
                .attr("r", size_dot)
                .attr("fill", function(d){return get_color(si,ds.k);});
        }

        for(var ds of [{a:0.5,b:1/6+1,k:"north"},{a:0.5,b:5/6-1, k:"south"}, {a:1/6+1,b:0.5,k:"east"},{a:5/6-1,b:0.5,k:"west"}])
        {
            obja.append("circle")
            .attr("cx", size_cell_rule*ds.a)  
                .attr("cy", size_cell_rule*ds.b)
                .attr("r", size_dot)
                .attr("fill", function(d){return get_color(so,ds.k);});
        }

        var objb = obj.append("g")
            .attr("transform",function(d,i){
                    return "translate(" + (size_cell_rule*2 + size_dot*3) + "," + size_dot*3+")";
                    });

        objb.append("rect")
            .attr("stroke", "black")
            .attr("fill", "#dddddd")
            .attr("width", size_cell_rule)
            .attr("height", size_cell_rule);

        for(var ds of [{a:0.5,b:1/6,k:"north"},{a:0.5,b:5/6, k:"south"}, {a:1/6,b:0.5,k:"east"},{a:5/6,b:0.5,k:"west"}])
        {
            objb.append("circle")
            .attr("cx", size_cell_rule*ds.a)  
                .attr("cy", size_cell_rule*ds.b)
                .attr("r", size_dot)
                .attr("fill", function(d){return get_color(ei,ds.k);});
        }

        for(var ds of [{a:0.5,b:1/6+1,k:"north"},{a:0.5,b:5/6-1, k:"south"}, {a:1/6+1,b:0.5,k:"east"},{a:5/6-1,b:0.5,k:"west"}])
        {
            objb.append("circle")
            .attr("cx", size_cell_rule*ds.a)  
                .attr("cy", size_cell_rule*ds.b)
                .attr("r", size_dot)
                .attr("fill", function(d){return get_color(eo,ds.k);});
        }
    }

}

function load_from_file(e,func){
    var f = e.target.files[0];
    if (f){
        var r = new FileReader();
        r.onloadend = function(e){
            func(r.result, f.name);
        }
        r.readAsText(f);
        e.srcElement.value="";
    }
    else
    {
    }
}

