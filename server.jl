doc = """STCA Sim Server

Usage:
   prog.jl [--port=]
   prog.jl -h | --help                                                                                  
   prog.jl --version                                                                   

Args:
   <cell>         Initial cell space states
   <rule>         Transition rules
   <output>       Output file name

Options:
   --port=VALUE   port number [default: 8080].

"""

using DocOpt
using WebSockets
using HttpServer
import JSON
using STCA
using Compat

const keyREQ="req"
const keyARG="arg"
const keyCELL="cell"
const keyRULE="rule"
const keyCOUNT="count"
const keyRET="ret"
const keyMSG="msg"

const keyREQ_ECHO="ECHO"
const keyREQ_INITCELL="INITCELL"
const keyREQ_INITRULE="INITRULE"
const keyREQ_GETCELL="GETCELL"
const keyREQ_UPDATECELL="UPDATECELL"
const keyREQ_GETLOG="GETLOG"

type STCAData
    cells::Dict{Integer, CellSpace}
    rules::Dict{Integer, Rule}
    logs::Dict{Integer, String}
    function STCAData()
        new(Dict{Integer, CellSpace}(),Dict{Integer, Rule}(), Dict{Integer, String}())
    end
end

function packdata(req,d,ret=true)
    JSON.json(Dict{Any,Any}(keyREQ=>req, keyARG=>d, keyRET=>ret))
end

function gen_arg(name, d)
    Dict{Any,Any}(name=>d)
end

function add_arg!(arg, name, d)
    arg[name] = d
end

function req_echo(client, req, arg, data::STCAData)
    println("client: $(client.id)")
    println("arg: $(arg)")
    write(client, packdata(req, nothing))
end

function req_init_cell(client, req, arg, data::STCAData)
    println("init_cell")
    mat = reduce(hcat, arg[keyCELL])
    mat = convert(Array{ASCIIString}, mat)
    data.cells[client.id] = STCA.load_cell(mat)
    req_get_cell(client, req, arg, data)
end

function req_init_rule(client, req, arg, data::STCAData)
    println("init_rule")
    lines = arg[keyRULE]
    lines = convert(Array{ASCIIString}, lines)
    rule = STCA.load_rule(lines)
    data.rules[client.id] = rule

    rdic = @compat Dict{UInt32,Array{UInt32}}()
    for d in rule.dict
        a = d[1]
        b = d[2][1]
        k = d[2][2]
        rdic[k] = [a>>32, (a&0xffffffff), b>>32, (b&0xffffffff)]
    end
    rarg = gen_arg(keyRULE, @compat Dict("dict"=>rdic, "N"=>rule.N, "Nrot"=>rule.Nrot, "states"=>rule.states))
    write(client, packdata(req, rarg))
end

function req_get_cell(client, req, arg, data::STCAData)
    println("get_cell")
    rarg = gen_arg(keyCELL, data.cells[client.id].cells)
    write(client, packdata(req, rarg))
end

function req_update_cell(client, req, arg, data::STCAData)
    println("update")
    count = arg[keyCOUNT]
    for i=1:count
        update!(data.cells[client.id], data.rules[client.id], :Checkerboard)
    end
    req_get_cell(client, req, arg, data)
end

function req_get_log(client, req, arg, data::STCAData)
    println("get_log")
    rarg = gen_arg(keyLOG, data.log[client.id])
    write(client, packdata(req, rarg))
end

const req_funcs = @compat Dict(
keyREQ_ECHO=>req_echo,
keyREQ_INITCELL=>req_init_cell,
keyREQ_INITRULE=>req_init_rule,
keyREQ_GETCELL=>req_get_cell,
keyREQ_UPDATECELL=>req_update_cell,
keyREQ_GETLOG=>req_get_log
)

function run_server(port)
    srvdata = STCAData()
    wsh = WebSocketHandler() do req,client
        while true
            try
                msg = JSON.parse(convert(ASCIIString,read(client)))
                req = msg[keyREQ]
                arg = msg[keyARG]

                if haskey(req_funcs, req)
                    println("id: ", client.id)
                    req_funcs[req](client, req, arg, srvdata)
                else
                    throw("unknown request: $req")
                    write(client, packdata(keyREQ, nothing,false))
                end
            catch ev
                println(ev)
                break
            end
        end
    end

    server = Server(wsh)
    run(server,port)
end

function main()
    args = docopt(doc, version=v"1.0.0")
    port = parse(Int, args["--port"])

    run_server(port)
    println("exit")
end

main()



