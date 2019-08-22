/// <reference path="speech.ts" />
namespace manebu {
declare var MathJax:any;

var selected_mjx : HTMLElement[] = [];
export var textMath : HTMLTextAreaElement;
var divMath : HTMLDivElement;

console.log("hello");

function last<T>(v:Array<T>) : T{
    console.assert(v.length != 0);

    return v[v.length - 1];
}

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

function getElementJaxAncestor(node:any){

    function* fnc(node:any){
        for(let nd = node.parent; nd != undefined; nd = nd.parent){
            yield nd;
        }
    }

    return Array.from(fnc(node));
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

function dumpJax(root:any){
    for(let node of getElementJax(root)){

        var nest = getElementJaxAncestor(node).length;

        var ele = getDomFromJax(node);
        if(["mi", "mn", "mo"].includes(node.nodeName)){
            var text = ele.textContent;
            console.log(`ej ${" ".repeat(2 * nest)}${node.nodeName} ${text}`);
        }
        else{

            console.log(`ej ${" ".repeat(2 * nest)}${node.nodeName}`);
        }    
    }
}

function makeDomJaxMap() : [any, Map<HTMLElement, any>]{
    var all_jax = MathJax.Hub.getAllJax();
    var map = new Map<HTMLElement, any>();
    for(let ej of all_jax){
        for(let node of getElementJax(ej.root)){

            var ele = getDomFromJax(node);
            map.set(ele, node);
        }
    }

    return [all_jax, map];
}

function getJaxPath(jax_idx: number, jax_list:any[], max_nest: number) : any[]{
    var path : any[] = [];

    var parent = jax_list[0];

    path.push({ "idx": jax_idx, "nodeName": parent.nodeName});

    for(var nest = 1; nest <= max_nest; nest++){
        var jax = jax_list[nest];
        var idx = parent.childNodes.indexOf(jax);
        console.assert(idx != -1);
        path.push({ "idx": idx, "nodeName": jax.nodeName});
        parent = jax;
    }

    return path;
}

function getJaxFromPath(all_jax:any[], path:any[]){
    var node = all_jax[path[0]["idx"]].root;
    console.assert(node.nodeName == path[0]["nodeName"])

    for(let obj of path.slice(1)){
        node = node.childNodes[obj["idx"]];
        console.assert(node.nodeName == obj["nodeName"])
    }

    return node;
}

class Action {
    type: string;

    constructor(type: string){
        this.type = type;
    }
}

export var actions : Action[] = [];
export var action_pos : number = 0;

export class TextBlockAction extends Action {
    text: string;

    constructor(text: string){
        super("TextBlockAction");
        this.text = text;
    }
}

export class SpeechAction extends Action {
    text: string;

    constructor(text: string){
        super("SpeechAction");
        this.text = text;
    }
}

export class SelectionAction extends Action {

    constructor(){
        super("SelectionAction");
    }
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

        var [all_jax, map] = makeDomJaxMap();

        var sel = window.getSelection();
        
        if(sel.rangeCount == 1){

            var rng = sel.getRangeAt(0);

            console.log(`start:${rng.startContainer.textContent} end:${rng.endContainer.textContent}`);

            var st_a = getDomAncestor(rng.startContainer).filter(x => map.has(x)).map(x => map.get(x)).reverse();
            var jax_idx;
            for(jax_idx = 0; jax_idx < all_jax.length; jax_idx++){
                if(all_jax[jax_idx].root == st_a[0]){
                    break;
                }
            }

            console.log(`all jax: ${jax_idx}`);

            if(rng.startContainer == rng.endContainer){

                if(st_a.length != 0){

                    var path = getJaxPath(jax_idx, st_a, st_a.length - 1);
                    console.log(`path: ${path.map(x => `${x["idx"]}:${x["nodeName"]}`).join(',')}`);
                    var node = getJaxFromPath(all_jax, path);
                    console.assert(node == last(st_a));
                    set_current_mjx(getDomFromJax(last(st_a)));
                }
            }
            else{

                var ed_a = getDomAncestor(rng.endContainer).filter(x => map.has(x)).map(x => map.get(x)).reverse();

                for(var nest = 0; nest < Math.min(st_a.length, ed_a.length); nest++){
                    if(st_a[nest] != ed_a[nest]){

                        console.assert(nest != 0);

                        var parent_jax = st_a[nest - 1];

                        if(parent_jax.nodeName == "msubsup"){

                            var path = getJaxPath(jax_idx, st_a, nest - 1);
                            console.log(`path: ${path.map(x => `${x["idx"]}:${x["nodeName"]}`).join(',')}`);
                            var node = getJaxFromPath(all_jax, path);
                            console.assert(node == parent_jax);
        
                            set_current_mjx(getDomFromJax(parent_jax));
                        }
                        else{

                            var st_i = getJaxIndex(st_a[nest]);
                            var ed_i = getJaxIndex(ed_a[nest]);

                            var path : any[];
                            var node;
                            path = getJaxPath(jax_idx, st_a, nest);
                            console.log(`path1: ${path.map(x => `${x["idx"]}:${x["nodeName"]}`).join(',')}`);
                            node = getJaxFromPath(all_jax, path);
                            console.assert(node == st_a[nest]);

                            path = getJaxPath(jax_idx, ed_a, nest);
                            console.log(`path2: ${path.map(x => `${x["idx"]}:${x["nodeName"]}`).join(',')}`);
                            node = getJaxFromPath(all_jax, path);
                            console.assert(node == ed_a[nest]);

                            console.log(`start:${st_i} end:${ed_i}`);
                            // dumpJax(parent_jax);

                            var nodes = parent_jax.childNodes.slice(st_i, ed_i + 1);
                            for(let nd of nodes){

                                if(nd != null){

                                    set_current_mjx(getDomFromJax(nd));
                                }
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

    if(divMath.childNodes.length != 0){

        divMath.appendChild(document.createElement("hr"));
    }
    divMath.appendChild(ele);

    return ele;
}

var typeset_ended = false;
function ontypeset(blc: TextBlock, id: number){
    console.log(`${blc.ele} ${id}`);

    var math_elements = blc.ele.getElementsByClassName("mjx-math");
    for(let ele of math_elements){

        // (ele as HTMLSpanElement).style.userSelect = "none";
    }

    typeset_ended = true;
}


export function addTextBlock(text: string){
    actions.push(new TextBlockAction(text));
}

export function addSelection(){
    // actions.push(new TextBlockAction(text));
}

export function init_manebu(){
    console.log("body loaded");

    init_speech();

    divMath = document.getElementById("div-math") as HTMLDivElement;
    textMath = document.getElementById("txt-math") as HTMLTextAreaElement;

    // addTextBlock(textMath.value);

    textMath.onblur = function(ev:FocusEvent){
        console.log(`blur:${textMath.value.charAt(0)} ${textMath.value.charCodeAt(0).toString(16)} ${"🙀".charCodeAt(0).toString(16)}`);
        if(textMath.value.charCodeAt(0) != "🙀".charCodeAt(0)){
            return;
        }
        
        var sel = window.getSelection();
        
        if(sel.rangeCount == 1){

            var rng = sel.getRangeAt(0);
            console.log(`blur2 ${ev} ${sel.rangeCount} start:${textMath.selectionStart} end:${textMath.selectionEnd}`);
        }
        textMath.value = textMath.value.substring(0, textMath.selectionStart) + "🙀" + textMath.value.substring(textMath.selectionEnd);
    }

}
export function txt_math_onselect(ev){
    console.log(`select ${ev}`);
}
export function txt_math_onblur(ev){
    console.log(`blur ${ev}`);
}

function* makeTextBlock(act: TextBlockAction){
    typeset_ended = false;

    var blc = new TextBlock(act.text);
    blc.make();
    textMath.value = "";

    MathJax.Hub.Queue(["Typeset",MathJax.Hub]);
    MathJax.Hub.Queue([ontypeset, blc, 123]);

    while(! typeset_ended){
        yield;
    }
}

function* play_gen(start_pos: number){
    for(action_pos = start_pos; action_pos < actions.length; action_pos++){
        var act = actions[action_pos];
        switch(act.type){
        case "TextBlockAction":
            yield* makeTextBlock(act as TextBlockAction);
            break;
        case "SpeechAction":
            
            yield* speak(act as SpeechAction);
            break;
        }
    }
}

export function play(pos:number){
    var gen = play_gen(pos);
    var id = setInterval(function(){
        var ret = gen.next();
        if(ret.done){
            clearInterval(id);
        }
    },100);
}

export function resume(){
    if(action_pos < actions.length){
        play(action_pos);
    }
}

}