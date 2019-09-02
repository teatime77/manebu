/// <reference path="speech.ts" />
/// <reference path="firebase.ts" />
namespace manebu {
declare var MathJax:any;

var selected_mjx : HTMLElement[] = [];
export var textMath : HTMLTextAreaElement;
export var divMath : HTMLDivElement;
var tmpSelection : SelectionAction | null = null;
var blue_style = { "color": "blue" };
var red_style  = { "color": "red" };
export var inEditor : boolean;
var TextBlockId = 0;
var textMathSelectionStart : number = 0;
var textMathSelectionEnd : number = 0;
var divMsg : HTMLDivElement = null;

function last<T>(v:Array<T>) : T{
    console.assert(v.length != 0);

    return v[v.length - 1];
}

export function msg(text: string){
    console.log(text);

    if(divMsg != null){

        divMsg.textContent = divMsg.textContent + "\n" + text;
        divMsg.scrollTop = divMsg.scrollHeight;
    }
}

function set_current_mjx(node : HTMLElement, style:any){
    if(! selected_mjx.includes(node)){

        selected_mjx.push(node);

        console.assert(style["color"] != undefined)
        if(style["color"] == "blue"){

            // node.style.color = "#00CC00";
            node.style.color = "#8080FF";
            // node.style.textDecoration = "wavy underline red"
            node.style.backgroundColor = "#C0C0C0";
        }
        else{

            node.style.color = style["color"];
        }
    }
}

export function restore_current_mjx_color(){
    for(let node of selected_mjx){

        node.style.color = "unset";
        // node.style.textDecoration = "unset"
        node.style.backgroundColor = "unset";
    }

    selected_mjx = [];
}

function* getJaxDescendants(node:any){
    if(node != null && node.nodeName != undefined && node.CHTMLnodeID != undefined){

        yield node;

        if(! ["mi", "mn", "mo"].includes(node.nodeName)){

            if(node.childNodes != undefined){
                for(let nd of node.childNodes){
                    yield* getJaxDescendants(nd);
                }
            }
        }
    }
}

function getDomAncestors(node){
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

function makeDomJaxMap() : [any, Map<HTMLElement, any>]{
    var all_jax = MathJax.Hub.getAllJax();
    var map = new Map<HTMLElement, any>();
    for(let ej of all_jax){
        for(let node of getJaxDescendants(ej.root)){

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

export function convert(){
    var [all_jax, map] = makeDomJaxMap();

    var lines = textMath.value.split('\n');
    for(let [idx,line] of lines.entries()){
        if(line.startsWith("@select")){
            var act = JSON.parse(line.substring(7).trim()) as SelectionAction;

            var start_jax = getJaxFromPath(all_jax, act.start_path);

            var v1 = act.start_path.map(x => [x["idx"], x["nodeName"]]);
            var obj2 = { "type":act.dom_type, "start": v1};
            if(act.end_path != null){

                obj2["end"] = act.end_path.map(x => [x["idx"], x["nodeName"]]);
            }
            lines[idx] = "@select " + JSON.stringify(obj2);
        }
    }

    textMath.value = lines.join('\n');
}

function onclick_block(){
    msg("clicked");

    restore_current_mjx_color();

    var ev = window.event as MouseEvent;
    ev.stopPropagation();

    var mjx_math = null;
    for(var ele = ev.srcElement as HTMLElement;; ele = ele.parentNode as HTMLElement){

        if(ele.tagName != "SPAN"){
            break;
        }
        if(ele.className == "mjx-math"){
            mjx_math = ele;
            break;
        }
    }
    if(mjx_math == null){
        return;
    }

    var [all_jax, map] = makeDomJaxMap();

    function check_path(text: string, path:any[], node_sv: any){
        msg(`${text}: ${path.map(x => `${x["idx"]}:${x["nodeName"]}`).join(',')}`);
        var node = getJaxFromPath(all_jax, path);
        console.assert(node == node_sv);
    }

    var sel = window.getSelection();
    
    if(sel.rangeCount == 1){

        var rng = sel.getRangeAt(0);

        msg(`start:${rng.startContainer.textContent} end:${rng.endContainer.textContent}`);

        var st_a = getDomAncestors(rng.startContainer).filter(x => map.has(x)).map(x => map.get(x)).reverse();
        var jax_idx;
        for(jax_idx = 0; jax_idx < all_jax.length; jax_idx++){
            if(all_jax[jax_idx].root == st_a[0]){
                break;
            }
        }

        msg(`all jax: ${jax_idx}`);

        if(rng.startContainer == rng.endContainer){

            if(st_a.length != 0){

                var start_path = getJaxPath(jax_idx, st_a, st_a.length - 1);
                check_path("path", start_path, last(st_a));

                tmpSelection = new SelectionAction(blue_style, "math", start_path, null);
            }
        }
        else{

            var ed_a = getDomAncestors(rng.endContainer).filter(x => map.has(x)).map(x => map.get(x)).reverse();

            for(var nest = 0; nest < Math.min(st_a.length, ed_a.length); nest++){
                if(st_a[nest] != ed_a[nest]){

                    console.assert(nest != 0);

                    var parent_jax = st_a[nest - 1];

                    if(parent_jax.nodeName == "msubsup"){

                        var start_path = getJaxPath(jax_idx, st_a, nest - 1);
                        check_path("path", start_path, parent_jax);

                        tmpSelection = new SelectionAction(blue_style, "math", start_path, null);
                    }
                    else{

                        var start_path = getJaxPath(jax_idx, st_a, nest);
                        var end_path   = getJaxPath(jax_idx, ed_a, nest);

                        check_path("path1", start_path, st_a[nest]);
                        check_path("path2", end_path  , ed_a[nest]);

                        tmpSelection = new SelectionAction(blue_style, "math", start_path, end_path);
                    }
                    break;
                }
            }
        }

        if(tmpSelection != null){
            setSelection(tmpSelection);
        }
    }

    window.getSelection().removeAllRanges();
}

export class SelectionAction {
    style : any;
    dom_type: string;
    start_path:any[];
    end_path:any[] | null;

    constructor(style: any, dom_type:string, start_path:any[], end_path:any[] | null){
        this.style = style;
        this.dom_type = dom_type;
        this.start_path = start_path;
        this.end_path   = end_path;
    }
}


export function getTextBlockId(id: number) : string {
    return `manebu-text-block-${id}`;
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

var typeset_ended = false;
function ontypeset(text: string, id: number){
    msg(`${text} ${id}`);

    typeset_ended = true;

    divMath.scrollTop = divMath.scrollHeight;
}

export function insertText(ins_str: string){
    textMath.value = textMath.value.substring(0, textMathSelectionEnd) + ins_str + textMath.value.substring(textMathSelectionEnd);
}

export function addSelection(){
    if(tmpSelection == null){
        return;
    }

    restore_current_mjx_color();

    tmpSelection.style = red_style;

    var ins_str = '\n@select ' + JSON.stringify(tmpSelection) + '\n';
    insertText(ins_str);

    setSelection(tmpSelection);
}

export function init_manebu(in_editor: boolean){
    inEditor = in_editor;
    divMsg = document.getElementById("div-msg") as HTMLDivElement;
    divMath = document.getElementById("div-math") as HTMLDivElement;

    msg("body loaded");

    firebase_init();
    init_speech();

    if(! inEditor){
        return;
    }

    textMath = document.getElementById("txt-math") as HTMLTextAreaElement;

    textMath.onblur = function(ev:FocusEvent){
        var sel = window.getSelection();
        
        if(sel.rangeCount == 1){

            var rng = sel.getRangeAt(0);
            textMathSelectionStart = textMath.selectionStart;
            textMathSelectionEnd = textMath.selectionEnd;
            msg(`blur2 ${ev} ${sel.rangeCount} start:${textMathSelectionStart} end:${textMathSelectionEnd}`);

            if(textMath.value.charCodeAt(0) == "🙀".charCodeAt(0)){
                msg(`blur:${textMath.value.charAt(0)} ${textMath.value.charCodeAt(0).toString(16)} ${"🙀".charCodeAt(0).toString(16)}`);
                textMath.value = textMath.value.substring(0, textMathSelectionStart) + "🙀" + textMath.value.substring(textMathSelectionEnd);
            }        
        }
    }

    init_shape();
}

/*
    HTML要素を作る。
*/
export function* appendTextBlock(lines: string[]){
    // 最初の空行を除去する。
    while(lines.length != 0 && lines[0].trim() == ""){
        lines.shift();
    }

    // 末尾の空行を除去する。
    while(lines.length != 0 && last(lines).trim() == ""){
        lines.pop();
    }

    var text = lines.join('\n');

    typeset_ended = false;

    TextBlockId++;
        
    var text_block_id = getTextBlockId(TextBlockId);

    var span = document.createElement("span");
    span.innerHTML = make_html_lines(text);
    span.addEventListener("click", onclick_block);

    span.className = "manebu-text-block";

    span.addEventListener('keydown', (event) => {
        msg(`key down ${event.key} ${event.ctrlKey}`);
      }, false);        

    divMath.lastChild.appendChild(span);

    MathJax.Hub.Queue(["Typeset",MathJax.Hub]);
    MathJax.Hub.Queue([ontypeset, "append", 123]);

    while(! typeset_ended){
        yield;
    }
}

export function setSelection(act: SelectionAction){
    console.assert(act.dom_type == "math" && act.style != undefined);

    var [all_jax, map] = makeDomJaxMap();

    var start_jax = getJaxFromPath(all_jax, act.start_path);
    var st_i = last(act.start_path)["idx"];

    var parent_jax = start_jax.parent;
    console.assert(getJaxIndex(start_jax) == st_i);
    console.assert(start_jax.nodeName == last(act.start_path)["nodeName"])

    if(act.end_path == null){

        set_current_mjx(getDomFromJax(start_jax), act.style);
    }
    else{

        var end_jax = getJaxFromPath(all_jax, act.end_path);

        var ed_i = last(act.end_path)["idx"];

        console.assert(getJaxIndex(end_jax) == ed_i);
        console.assert(end_jax.nodeName == last(act.end_path)["nodeName"])
    
        var nodes = parent_jax.childNodes.slice(st_i, ed_i + 1);
        for(let nd of nodes){

            if(nd != null){

                set_current_mjx(getDomFromJax(nd), act.style);
            }
        }    
    }
}

export function substitute(){
    var s = textMath.value;

    var [all_jax, map] = makeDomJaxMap();

    var start_jax = getJaxFromPath(all_jax, tmpSelection.start_path);

    var idx = getJaxIndex(start_jax);
    all_jax[2].root.parent = start_jax.parent;
    start_jax.parent.childNodes[idx] = all_jax[2].root;

    all_jax[1].Rerender();
}

}