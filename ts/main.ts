/// <reference path="speech.ts" />
namespace manebu {
declare var MathJax:any;
var dom_list : (HTMLElement | SVGSVGElement)[] = [];

console.log("hello");

class TextBlock {
    text: string;
    ele: HTMLDivElement | null;

    constructor(text: string){
        this.text = text;
        this.ele = null;
    }

    /*
        HTML要素を作る。
    */
    make(){
        this.ele = make_div(this.text);
        this.ele.addEventListener("click", this.onclick_block);
    }
    
    onclick_block=()=>{
        var ev = window.event as KeyboardEvent;

        ev.stopPropagation();

        console.log("clicked");
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

function make_html_lines(text: string){
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

function make_div(text: string){
    var ele = document.createElement("div");
    ele.innerHTML = make_html_lines(text);
    document.body.appendChild(ele);
    
    dom_list.push(ele);

    return ele;
}

function dump_mjx(ele: HTMLElement, nest: number ){
    if(ele.className != undefined && ele.className.startsWith("mjx-")){

        if([ "mjx-mi", "mjx-mn", "mjx-mo" ].includes(ele.className)){

            console.log(`${" ".repeat(nest * 2)}${ele.className} ${ele.id} ${ele.innerText}`);
            return;
        }
        console.log(`${" ".repeat(nest * 2)}${ele.className} ${ele.id}`);
        nest++;
    }
    for(let ele2 of ele.childNodes){
        dump_mjx(ele2 as HTMLElement, nest + 1);
    }
}
function ontypeset(blc: TextBlock, id: number){
    console.log(`${blc.ele} ${id}`);

    dump_mjx(blc.ele, 0);

    var pi = document.getElementById("MJXc-Node-14");
    pi.style.color = "red";

}

export function init_manebu(){
    console.log("body loaded");

    init_speech();

    let s = (document.getElementById("txt-math") as HTMLTextAreaElement).value;

    var blc = new TextBlock(s);
    blc.make();

    MathJax.Hub.Queue(["Typeset",MathJax.Hub]);
    MathJax.Hub.Queue([ontypeset, blc, 123]);
}
}