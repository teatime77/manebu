namespace manebu{
export var padding = 10;
const endMark = "🔚";

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

export function stringify(text: string){
    if(! text.includes('\n')){
        return JSON.stringify(text) + '\n';
    }
    else{
        return `${endMark}\n${text}${endMark}\n`;
    }
}

export function serializeActions() : string {
    return actions.map(x => x.serialize()).join('\n');
}

export function deserializeActions(text: string){
    actions = [];

    var lines = text.split('\n');
    while(lines.length != 0){
        // 空行をスキップする。
        for(; lines.length != 0 && lines[0].trim() == ""; lines.shift());
        if(lines.length == 0){
            break;
        }

        var line = lines.shift();
        var obj;
        if(line.startsWith("json:")){
            obj = JSON.parse(line.substring(5).trim());
        }
        else{
            console.assert(line.startsWith("type_name:"));

            obj = {};
            obj["type_name"] = line.substring(10).trim();

            while(lines.length != 0){
                line = lines.shift().trim();
                if(line == ""){
                    break;
                }
                var k = line.indexOf(':');
                console.assert(k != -1);

                var name = line.substring(0, k).trim();
                var value;
                var mark = line.substring(k + 1).trim();
                if(mark != endMark){

                    value = JSON.parse(mark);
                }
                else{
                    var last_idx = lines.findIndex(x => x.endsWith(mark));
                    var texts = lines.splice(0, last_idx + 1);
                    value = texts.join('\n');
                    value = value.substring(0, value.length - mark.length);
                }

                obj[name] = value;
            }
        }

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
        default:
            console.assert(false);
            break;
        }
        actions.push(act);
    }
}

}