/// <reference path="speech.ts" />
namespace manebu {
declare var MathJax:any;

var selected_mjx : HTMLElement[] = [];


console.log("hello");


function set_current_mjx(node : HTMLElement){
    if(! selected_mjx.includes(node)){

        selected_mjx.push(node);

        node.style.color = "red";
    }
}

function restore_current_mjx_color(){
    for(let node of selected_mjx){

        node.style.color = "unset";
    }

    selected_mjx = [];
}

function* getElementJax(node:any){
    if(node != null && node.nodeName != undefined && node.CHTMLnodeID != undefined){

        yield node;

        if(! ["mi", "mn", "mo"].includes(node.nodeName)){

            if(node.childNodes != undefined){
                for(let nd of node.childNodes){
                    yield* getElementJax(nd);
                }
            }
        }
    }
}

function* getElementJaxAncestor(node:any){
    for(let nd = node.parent; nd != undefined; nd = nd.parent){
        yield nd;
    }
}

function getDomAncestor(node){
    function* fnc(node){
        for(let nd = node; nd != null; nd = nd.parentNode){
            yield nd;
        }
    }

    return Array.from(fnc(node));
}

function getDomFromJax(node) : HTMLElement{
    return document.getElementById(`MJXc-Node-${node.CHTMLnodeID}`);
}

function getJaxIndex(node){
    return node.parent.childNodes.indexOf(node);
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
            // if (event.key === 'Control') {
            //   // do not alert when only Control key is pressed.
            //   return;
            // }

            // if(current_mjx == null || ! event.ctrlKey){
            //     return;
            // }

            // if (event.key === 'ArrowUp'){
            //     if(current_mjx.parent == null){
            //         return;
            //     }

            //     set_current_mjx(current_mjx.parent);
            // }
            // if (event.key === 'ArrowRight' || event.key === 'ArrowLeft'){
            // }

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

        restore_current_mjx_color();

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

        var obj4 = MathJax.Hub.getAllJax();
        var map = new Map<HTMLElement, any>();
        for(let ej of obj4){
            for(let node of getElementJax(ej.root)){

                var nest = Array.from( getElementJaxAncestor(node) ).length;

                var ele = getDomFromJax(node);
                map.set(ele, node);
                if(["mi", "mn", "mo"].includes(node.nodeName)){
                    var text = ele.textContent;
                    console.log(`ej ${" ".repeat(2 * nest)}${node.nodeName} ${text}`);
                }
                else{

                    console.log(`ej ${" ".repeat(2 * nest)}${node.nodeName}`);
                }    
            }
        }

        var sel = window.getSelection();
        
        if(sel.rangeCount == 1){

            var rng = sel.getRangeAt(0);

            if(rng.startContainer == rng.endContainer){

                var v = getDomAncestor(rng.startContainer).filter(x => map.has(x));
                if(v.length != 0){

                    set_current_mjx(v[0]);
                }
            }
            else{

                var st_a = getDomAncestor(rng.startContainer).filter(x => map.has(x)).map(x => map.get(x)).reverse();
                var ed_a = getDomAncestor(rng.endContainer).filter(x => map.has(x)).map(x => map.get(x)).reverse();

                for(var nest = 0; nest < Math.min(st_a.length, ed_a.length); nest++){
                    if(st_a[nest] != ed_a[nest]){

                        console.assert(nest != 0);

                        var st_i = getJaxIndex(st_a[nest]);
                        var ed_i = getJaxIndex(ed_a[nest]);

                        var nodes = st_a[nest - 1].childNodes.slice(st_i, ed_i + 1);
                        for(let nd of nodes){

                            if(nd != null){

                                set_current_mjx(getDomFromJax(nd));
                            }
                        }    
                    }
                }
            }
        }

        window.getSelection().removeAllRanges();
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

    document.getElementById("div-math").appendChild(ele);

    return ele;
}

function ontypeset(blc: TextBlock, id: number){
    console.log(`${blc.ele} ${id}`);

    var math_elements = blc.ele.getElementsByClassName("mjx-math");
    for(let ele of math_elements){

        // (ele as HTMLSpanElement).style.userSelect = "none";
    }
}

export function init_manebu(){
    console.log("body loaded");

    init_speech();

    let s = (document.getElementById("txt-math") as HTMLTextAreaElement).value;

    var blc = new TextBlock(s);
    blc.make();

    MathJax.Hub.Queue(["Typeset",MathJax.Hub]);
    MathJax.Hub.Queue([ontypeset, blc, 123]);

    var txt_math = document.getElementById("txt-math") as HTMLTextAreaElement;
    txt_math.onblur = function(ev:FocusEvent){
        
        var sel = window.getSelection();
        
        if(sel.rangeCount == 1){

            var rng = sel.getRangeAt(0);
            console.log(`blur2 ${ev} ${sel.rangeCount} start:${txt_math.selectionStart} end:${txt_math.selectionEnd}`);
        }
        txt_math.value = txt_math.value.substring(0, txt_math.selectionStart) + "🙀" + txt_math.value.substring(txt_math.selectionEnd);
    }

}
export function txt_math_onselect(ev){
    console.log(`select ${ev}`);
}
export function txt_math_onblur(ev){
    console.log(`blur ${ev}`);
}
}