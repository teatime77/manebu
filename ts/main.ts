/// <reference path="speech.ts" />
namespace manebu {
declare var MathJax:any;

var dom_list : (HTMLElement | SVGSVGElement)[] = [];
var focused_mjx : MathMLNode | null = null;
var current_mjx_idx : number = -1;
var current_mjx : any = null;
var current_mjx_color : any = null;

var svg : SVGSVGElement;
var svg_ratio: number;
var current_rect : SVGRectElement;

console.log("hello");


function to_svg(x:number) : number{
    return x * svg_ratio;
}

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
        
        this.ele.addEventListener('keydown', (event) => {          
            if (event.key === 'Control') {
              // do not alert when only Control key is pressed.
              return;
            }

            if(focused_mjx == null || ! event.ctrlKey){
                return;
            }

            if (event.key === 'ArrowRight' || event.key === 'ArrowLeft'){
                var nodes: MathMLNode[] = focused_mjx.get_descendants();

                if (event.key === 'ArrowRight'){

                    if(current_mjx_idx + 1 < nodes.length){

                        current_mjx_idx++;
                    }
                }
                else{

                    if(0 < current_mjx_idx){
                        current_mjx_idx--;
                    }
                }

                var node = nodes[current_mjx_idx];
                if(node.ele == null){
                    return;
                }

                var rc = node.ele.getBoundingClientRect();

                move_svg_rect(current_rect, rc.left, rc.top, rc.width, rc.height);

                console.log(`key down ${event.key} ${event.ctrlKey} ${rc}`);
                return;
            }

            console.log(`key down ${event.key} ${event.ctrlKey}`);
          
            // if (event.ctrlKey) {
            //   // Even though event.key is not 'Control' (e.g., 'a' is pressed),
            //   // event.ctrlKey may be true if Ctrl key is pressed at the same time.
            //   alert(`Combination of ctrlKey + ${keyName}`);
            // } else {
            //   alert(`Key pressed ${keyName}`);
            // }
          }, false);        
    }
    
    onclick_block=()=>{
        console.log("clicked");

        var ev = window.event as MouseEvent;
        ev.stopPropagation();

        var mjx_math = null;
        for(var ele = ev.srcElement as HTMLElement;;){

            if(ele.tagName != "SPAN"){
                break;
            }
            if(ele.className == "mjx-math"){
                mjx_math = ele;
                break;
            }

            ele = ele.parentNode as HTMLElement;
        }
        if(mjx_math == null){
            return;
        }

        focused_mjx = new MathMLNode(null, "", null);
        dump_mjx(focused_mjx, mjx_math, 0);
        current_mjx_idx = 0;        

        var nodes = focused_mjx.get_descendants();
        var node_eles = nodes.map(x => x.ele);

        for(var ele = ev.srcElement as HTMLElement;;){
            if(ele.tagName != "SPAN"){
                break;
            }

            var i = node_eles.indexOf(ele);
            if(i != -1){

                node_eles[i].style.color = "red";
                break;
            }

            ele = ele.parentNode as HTMLElement;
        }

        if(ev.ctrlKey){

            focused_mjx.dump(0);
        }
    }
}

class MathMLNode {
    parent: MathMLNode | null;
    class_name : string;
    ele   : HTMLElement | null;
    children : MathMLNode[] = [];

    constructor(parent: MathMLNode | null, class_name: string, ele   : HTMLElement | null){
        this.parent = parent;
        this.class_name = class_name;
        this.ele = ele;
    }

    dump(nest: number){
        if([ "mi", "mn", "mo" ].includes(this.class_name)){

            console.log(`${" ".repeat(nest * 2)}${this.class_name} [${this.ele.textContent}]`);
        }
        else{

            console.log(`${" ".repeat(nest * 2)}${this.class_name}`);
        }

        for(let node of this.children){
            node.dump(nest + 1);
        }
    }

    add_descendants(nodes: MathMLNode[]){
        nodes.push(this);
        for(let node of this.children){
            node.add_descendants(nodes);
        }
    }
    
    get_descendants() : MathMLNode[]{
        var nodes: MathMLNode[] = [];
        this.add_descendants(nodes);
        return nodes;
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

function dump_mjx(parent:MathMLNode, ele: HTMLElement, nest: number ){
    var class_name = null;

    if(ele.className != undefined && ele.className.startsWith("mjx-m")){

        class_name = ele.className.split(' ')[0].substring(4);
        if(class_name == "mo" && ele.textContent.trim() == ""){

            console.log("空白の除去");
            return;
        }

        var node = new MathMLNode(parent, class_name, ele);
        parent.children.push(node);
        if([ "mi", "mn", "mo" ].includes(class_name)){

            return;
        }
        parent = node
        nest++;
    }

    for(let ele2 of ele.childNodes){
        dump_mjx(parent, ele2 as HTMLElement, nest);
    }

    if(class_name == "mrow" && parent != null && parent.parent != null && parent.children.length == 1){
        var idx = parent.parent.children.indexOf(parent);
        console.assert(idx != -1);

        console.log("mrowの簡約化");
        parent.parent.children[idx] = parent.children[0];
    }
}

function ontypeset(blc: TextBlock, id: number){
    console.log(`${blc.ele} ${id}`);

    var pi = document.getElementById("MJXc-Node-14");
    pi.style.color = "red";

}

function move_svg_rect(rect: SVGRectElement, x: number, y: number, width: number, height: number){
    rect.setAttribute("x", `${to_svg(x)}`);
    rect.setAttribute("y", `${to_svg(y)}`);
    rect.setAttribute("width", `${to_svg(width)}`);
    rect.setAttribute("height", `${to_svg(height)}`);
}

function make_svg_rect(x: number, y: number, width: number, height: number) : SVGRectElement {
    var rect : SVGRectElement = document.createElementNS("http://www.w3.org/2000/svg","rect");

    move_svg_rect(rect, x, y, width, height);
    rect.setAttribute("fill", "transparent");
    rect.setAttribute("stroke", "red");
    rect.setAttribute("stroke-width", `${to_svg(1)}`);

    svg.appendChild(rect);

    return rect;
}

export function init_manebu(){
    console.log("body loaded");

    svg  = document.getElementById("main-svg") as any as SVGSVGElement;
    var rc = svg.getBoundingClientRect() as DOMRect;
    svg_ratio = svg.viewBox.baseVal.width / rc.width;

    make_svg_rect(0, 0, 100, 50);
    current_rect = make_svg_rect(100, 50, 100, 50);



    init_speech();

    let s = (document.getElementById("txt-math") as HTMLTextAreaElement).value;

    var blc = new TextBlock(s);
    blc.make();

    MathJax.Hub.Queue(["Typeset",MathJax.Hub]);
    MathJax.Hub.Queue([ontypeset, blc, 123]);
}
}