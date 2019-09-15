namespace manebu{
export var padding = 10;
const endMark = "😀";
export var pointMap : Map<number, Point>;

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

export function handles_str(handles : Point[]){
    var texts = []

    for(let p of handles){
        if(pointMap.has(p.id)){

            texts.push( `{ "ref":${p.id} }` );
        }
        else{

            pointMap.set(p.id, p);
            texts.push( `{ "x":${p.pos.x}, "y":${p.pos.y} }` );
        }
    }

    return `[ ${texts.join(", ")} ]`;
}

export function serializeActions() : string {
    pointMap = new Map<number, Point>();

    var texts = [];
    for(let [i,x] of actions.entries()){
        var s1 = x.serialize();
        texts.push(s1);

        JSON.parse(reviseJson(s1));
    }

    return "[" + texts.join('\n,\n') + "]";
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
    var objs = JSON.parse(reviseJson(text));

    pointMap = new Map<number, Point>();

    actions = [];

    for(let obj of objs){
        var act = null;

        switch(obj["type_name"]){
        case TextBlockAction.name:
            act = TextBlockAction.deserialize(obj);
            break;
        case SpeechAction.name:
            act = SpeechAction.deserialize(obj);
            break;
        case SelectionAction.name:
            act = SelectionAction.deserialize(obj);
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
        actions.push(act);

    }
}

}