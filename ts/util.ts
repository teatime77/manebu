namespace manebu{
declare var MathJax:any;
export var padding = 10;
const endMark = "😀";
export var actionMap : Map<number, Action>;
var pendingRefs : any[];
var isPlaying: boolean = false;
var stopPlaying: boolean = false;

function ltrim(stringToTrim) {
	return stringToTrim.replace(/^\s+/,"");
}

export function array_last<T>(arr:T[]) : T{
    console.assert(arr.length != 0);
    return arr[arr.length - 1];
}

export function array_remove<T>(arr:T[], x:T) {
    var index = arr.indexOf(x);
    if (index != -1) {
        arr.splice(index, 1);
    }
}

function get_indent(line: string) : [number, string]{
    var indent = 0;
    while(true){
        if(line.startsWith("\t")){
            indent++;
            line = line.substring(1);    
        }
        else if(line.startsWith("    ")){
            indent++;
            line = line.substring(4);
        }
        else{
            return [indent, line];
        }
    }
}

function tab(indent: number){
    return " ".repeat(4 * indent);
}

export function make_html_lines(text: string){
    var lines = text.split('\n');
    var html_lines = [];            

    var in_math = false;
    var ul_indent = -1;
    var prev_line = "";
    for(let current_line of lines){
        var current_line_trim = current_line.trim();

        let [indent, line] = get_indent(current_line);
        indent--;

        if(current_line_trim == "$$"){
            in_math = ! in_math;
            html_lines.push(current_line);
        }
        else{
            if(in_math){

                html_lines.push(current_line);
            }
            else{

                if(line.startsWith("# ")){
                    html_lines.push(tab(indent + 1) + "<strong><span>" + line.substring(2) + "</span></strong><br/>")
                }
                else if(line.startsWith("- ")){
                    if(ul_indent < indent){
                        console.assert(ul_indent + 1 == indent);
                        html_lines.push(tab(indent) + "<ul>")
                        ul_indent++;
                    }
                    else{
                        while(ul_indent > indent){
                            html_lines.push(tab(ul_indent) + "</ul>")
                            ul_indent--;
                        }                            
                    }
                    html_lines.push(tab(indent + 1) + "<li><span>" + line.substring(2) + "</span></li>")
                }
                else{

                    if(prev_line.endsWith("</li>")){
                        html_lines[html_lines.length - 1] = prev_line.substring(0, prev_line.length - 5) + "<br/>";
                        html_lines.push(tab(indent + 1) + "<span>" + line + "</span></li>")
                    }
                    else{

                        html_lines.push(tab(indent + 1) + "<span>" + line + "</span><br/>")
                    }
                }
            }
        }

        prev_line = html_lines[html_lines.length - 1];
    }

    while(ul_indent != -1){
        html_lines.push(tab(ul_indent) + "</ul>")
        ul_indent--;
    }

    return html_lines.join("\n");
}

export function tostr(text: string){
    if(! text.includes('\n')){
        return JSON.stringify(text);
    }
    else{
        return `${endMark}${text}${endMark}`;
    }
}

function objToStr(obj: any, nest: number){
    var t1 = " ".repeat(4 * nest);
    var t2 = " ".repeat(4 * (nest + 1));

    if(Array.isArray(obj)){
        return `${t1}[\n` + (obj as any[]).map(x => objToStr(x, nest + 1)).join(`,\n`) + `\n${t1}]`;
    }

    if(typeof obj == "object"){

        if(obj.ref != undefined){
            
            return `${t1}{ "ref": ${obj.ref} }`;
        }

        if(obj.type_name == Point.name && obj.listeners == undefined && obj.bind_to == undefined){

            return `${t1}{ "type_name": "${obj.type_name}", "id": ${obj.id}, "pos": { "type_name": "${Vec2.name}", "x": ${obj.pos.x}, "y": ${obj.pos.y} } }`;
        }

        if(obj.constructor.name == Vec2.name){
            
            return `${t1}{ "type_name": "${Vec2.name}", "x": ${obj.x}, "y": ${obj.y} }`;
        }

        if(obj.type_name == "TextBox"){
            msg(``);
        }

        var lines = [];
        for (let [key, value] of Object.entries(obj)){
            lines.push(`${t2}"${key}": ${ltrim(objToStr(value, nest + 1))}`)
        }
        
        return `${t1}{\n` + lines.join(`,\n`) + `\n${t1}}`;
    }

    if(typeof obj == "string"){
        if(obj.includes('\n')){
            return `${endMark}${obj}${endMark}`;
        }
    }

    return JSON.stringify(obj);
}


export function fromObj(parent:any, key:any, obj: any){
    if(Array.isArray(obj)){

        var v = [];
        for(let [i, x] of (obj as any[]).entries()){
            v.push( fromObj(v, i, x) );
        }

        return v;
    }

    if(typeof obj == "object"){
        msg(`${obj.id} ${obj.type_name}`)

        var act;

        if(obj.ref != undefined){
            
            if(actionMap.has(obj.ref)){
                return actionMap.get(obj.ref);
            }
            else{
                
                pendingRefs.push({ parent:parent, key:key, ref: obj.ref });
                return obj;
            }
        }

        if(obj.type_name == Vec2.name){
            
            return new Vec2(obj.x, obj.y);
        }

        switch(obj["type_name"]){
        case TextBlockAction.name:
            act = new TextBlockAction(obj.text);
            break;
        case SpeechAction.name:
            act = new SpeechAction(obj.text);
            break;
        case SelectionAction.name:
            act = new SelectionAction(obj.block_id, obj.dom_type, obj.start_path, obj.end_path);
            break;
        case UnselectionAction.name:
            act = new UnselectionAction();
            break;

        case EndAction.name:
        case ShapeAction.name:
            console.assert(false);

        default:
            act = deserializeShapes(obj);
            console.assert(act != null);
            break;
        }

        for (let [key, value] of Object.entries(obj)){
            act[key] = fromObj(obj, key, value);
        }

        console.assert(!actionMap.has(act.id));
        actionMap.set(act.id, act);

        return act;
    }

    return obj;
}

export function serializeActions() : string {
    for(let [i,x] of all_actions.entries()){
        x.id = i;
    }
    actionMap = new Map<number, Action>();

    var action_objs = actions.map(x => x.toObj());

    return objToStr(action_objs, 0);
}

export function reviseJson(text:string){
    var ret = "";

    var el = endMark.length;
    while(true){
        var k1 = text.indexOf(endMark);
        if(k1 == -1){
            return ret + text;
        }

        var k2 = text.indexOf(endMark, k1 + el);
        console.assert(k2 != -1);

        ret += text.substring(0, k1) + JSON.stringify(text.substring(k1 + el, k2));
        text = text.substring(k2 + el);
    }
}

export function deserializeActions(text: string){
    var obj = JSON.parse(reviseJson(text));

    actionMap = new Map<number, Action>();
    pendingRefs = [];
    actions = fromObj(null,null, obj);

    for(let pending of pendingRefs){
        console.assert(actionMap.has(pending.ref));

        var act = actionMap.get(pending.ref);
        pending.parent[pending.key] = act;
    }
}


function* waitActions(){
    var typeset_done = false;
    MathJax.Hub.Queue(["Typeset",MathJax.Hub]);
    MathJax.Hub.Queue([function(){
        typeset_done = true;
    }]);

    while(! typeset_done){
        yield;
    }

    divMath.scrollTop = divMath.scrollHeight;
}

export function runGenerator(gen: IterableIterator<any>){
    isPlaying = true;
    stopPlaying = false;

    var id = setInterval(function(){
        var ret = gen.next();
        if(ret.done || stopPlaying){        

            isPlaying = false;
            clearInterval(id);
            msg("停止しました。");
        }
    },100);
}

export function openActionData(action_text: string){
    divMath.innerHTML = "";

    deserializeActions(action_text);

    if(actions.length == 0){
        ActionId = 0;
        actions.push(new TextBlockAction(""));
    }

    ActionId = Math.max(... actions.map(x => x.id)) + 1;
    focusedActionIdx = 0;

    divActions.innerHTML = "";

    function* fnc(){
        for(let act of actions){
            act.init();
            yield* act.restore();
            divActions.appendChild(act.summaryDom());
        }

        yield* waitActions(); 

        for(let act of actions.filter(x => x.constructor.name == "SelectionAction")){
            (act as SelectionAction).setSelectedDoms();
        }
    }

    runGenerator(fnc());
}

}