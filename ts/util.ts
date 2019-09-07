namespace MathMemo{
export var padding = 10;

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


export function get_size(ele: HTMLDivElement){
    var spans = ele.getElementsByTagName("span");

    var min_x = Number.MAX_VALUE, min_y = Number.MAX_VALUE;
    var max_x = 0, max_y = 0;
    for(let span of spans){
        if(span.className == "MathJax_Preview" || span.className == "MJX_Assistive_MathML MJX_Assistive_MathML_Block"){
            continue;
        }
        var rc = span.getBoundingClientRect();
        // console.log(`${span.className} rc:${rc.x},${rc.y},${rc.width},${rc.height}, ${span.innerText.replace('\n', ' ')}`);
        if(span.className == "MathJax_SVG"){

            max_x = Math.max(max_x, rc.width);
        }
        else{

            min_x = Math.min(min_x, rc.left);
            max_x = Math.max(max_x, rc.right);
        }
        min_y = Math.min(min_y, rc.top);
        max_y = Math.max(max_y, rc.bottom);
    }
    if(min_x == Number.MAX_VALUE){
        min_x = 0;
    }

    return [max_x - min_x, max_y - min_y]
}

}