/// <reference path="speech.ts" />
namespace manebu {
declare var MathJax:any;

var selected_mjx : HTMLElement[] = [];
export var textMath : HTMLTextAreaElement;
export var divMath : HTMLDivElement;
var divActions : HTMLDivElement;
var tmpSelection : SelectionAction | null = null;
var blue_style = { "color": "blue" };
var red_style  = { "color": "red" };
var isDesign = true;
var oldAction = false;
var TextBlockId = 0;
var textMathSelectionStart : number;
var textMathSelectionEnd : number;

console.log("hello");

function last<T>(v:Array<T>) : T{
    console.assert(v.length != 0);

    return v[v.length - 1];
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

function onclick_block(){
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

    function check_path(msg: string, path:any[], node_sv: any){
        console.log(`${msg}: ${path.map(x => `${x["idx"]}:${x["nodeName"]}`).join(',')}`);
        var node = getJaxFromPath(all_jax, path);
        console.assert(node == node_sv);
    }

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

                var start_path = getJaxPath(jax_idx, st_a, st_a.length - 1);
                check_path("path", start_path, last(st_a));

                tmpSelection = new SelectionAction(blue_style, "math", start_path, null);
            }
        }
        else{

            var ed_a = getDomAncestor(rng.endContainer).filter(x => map.has(x)).map(x => map.get(x)).reverse();

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

    toJSON() : string {
        // return `{\n ${JSON.stringify(this.text)}}\n`;
        return '{\n\t"text":' + JSON.stringify(this.text) + '}\n';
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
    style : any;
    dom_type: string;
    start_path:any[];
    end_path:any[] | null;

    constructor(style: any, dom_type:string, start_path:any[], end_path:any[] | null){
        super("SelectionAction");

        this.style = style;
        this.dom_type = dom_type;
        this.start_path = start_path;
        this.end_path   = end_path;
    }
}


export class RemoveAction extends Action {
    dom_id : string;

    constructor(dom_id : string){
        super("RemoveAction");
        this.dom_id = dom_id;
    }
}

export function getTextBlockId(id: number) : string {
    return `manebu-text-block-${id}`;
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
        if(divMath.childNodes.length != 0){

            divMath.appendChild(document.createElement("hr"));
        }

        TextBlockId++;
        
        var text_block_id = getTextBlockId(TextBlockId);
        var id_ele = "";

        if(oldAction){

            var btn = document.createElement("button") as HTMLButtonElement;
            btn.dataset.text_block_id = text_block_id;
            btn.addEventListener("click", function(ev:MouseEvent){
                var act = new RemoveAction(btn.dataset.text_block_id);
                actions.push(act)
                addActionSummary(act);
        
                resume();
            });
        
            btn.innerHTML = "❌";
            divMath.appendChild(btn);
        }
        else{

            id_ele = `<b>id:${TextBlockId}</b><br/>`;
        }
            
        this.ele = document.createElement("div");
        this.ele.id = text_block_id;
        this.ele.className = "manebu-text-block";
        this.ele.innerHTML = id_ele + make_html_lines(this.text);
        divMath.appendChild(this.ele);
    
        this.ele.addEventListener("click", onclick_block);
        
        this.ele.addEventListener('keydown', (event) => {
            console.log(`key down ${event.key} ${event.ctrlKey}`);
          }, false);        
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


var typeset_ended = false;
function ontypeset(msg: string, id: number){
    console.log(`${msg} ${id}`);

    typeset_ended = true;
}

export function addActionSummary(act: Action){
    var ele = document.createElement("div");

    var summary: string;
    switch(act.type){
        case "TextBlockAction":
            summary = "テキスト";
            break;
        case "SpeechAction":
            
            summary = `音声: ${(act as SpeechAction).text}`;
            break;

        case "SelectionAction":
            summary = "選択";
            break;

        case "RemoveAction":
            summary = `削除: ${(act as RemoveAction).dom_id}`;
            break;
    
        default:
            console.assert(false);
            break;
    }

    ele.innerHTML = summary;

    divActions.appendChild(ele);
}

export function addTextBlock(text: string){
    var act = new TextBlockAction(text)
    actions.push(act);
    addActionSummary(act);
}

export function addSelection_resume(){
    if(tmpSelection == null){
        return;
    }

    restore_current_mjx_color();

    tmpSelection.style = red_style;
    actions.push(tmpSelection);
    addActionSummary(tmpSelection);

    resume();
}


export function addSelection(){
    if(tmpSelection == null){
        return;
    }

    restore_current_mjx_color();

    tmpSelection.style = red_style;

    var ins_str = '\n@select ' + JSON.stringify(tmpSelection) + '\n';
    textMath.value = textMath.value.substring(0, textMathSelectionEnd) + ins_str + textMath.value.substring(textMathSelectionEnd);
}

export function init_manebu(){
    console.log("body loaded");

    init_speech();

    divMath = document.getElementById("div-math") as HTMLDivElement;
    textMath = document.getElementById("txt-math") as HTMLTextAreaElement;
    divActions = document.getElementById("div-actions") as HTMLDivElement;

    // addTextBlock(textMath.value);

    textMath.onblur = function(ev:FocusEvent){
        var sel = window.getSelection();
        
        if(sel.rangeCount == 1){

            var rng = sel.getRangeAt(0);
            textMathSelectionStart = textMath.selectionStart;
            textMathSelectionEnd = textMath.selectionEnd;
            console.log(`blur2 ${ev} ${sel.rangeCount} start:${textMathSelectionStart} end:${textMathSelectionEnd}`);

            if(textMath.value.charCodeAt(0) == "🙀".charCodeAt(0)){
                console.log(`blur:${textMath.value.charAt(0)} ${textMath.value.charCodeAt(0).toString(16)} ${"🙀".charCodeAt(0).toString(16)}`);
                textMath.value = textMath.value.substring(0, textMathSelectionStart) + "🙀" + textMath.value.substring(textMathSelectionEnd);
            }        
        }

    }

    if(window.location.search != "" && window.location.search[0] == '?'){
        var params = window.location.search.substring(1).split('&');
        var key_values = params.map(x => x.split('='));
        var map = new Map<string, string>(key_values.map(x => [x[0], x[1]] as [string, string]));

        var name = map.get("name");
        console.log(`name:${name}`);
        open_markdown(window.location.href, name);
    }
}

export function* makeTextBlock(act: TextBlockAction){
    typeset_ended = false;

    var blc = new TextBlock(act.text);
    blc.make();

    MathJax.Hub.Queue(["Typeset",MathJax.Hub]);
    MathJax.Hub.Queue([ontypeset, "make", 123]);

    while(! typeset_ended){
        yield;
    }
}

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

    var div = document.createElement("span");
    div.innerHTML = make_html_lines(text);
    div.addEventListener("click", onclick_block);

    divMath.lastChild.appendChild(div);

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

export function removeTextBlock(act: RemoveAction){
    var div = document.getElementById(act.dom_id);

    if(isDesign){

        if(oldAction){

            // 削除ボタンを削除する。
            console.assert(div.previousSibling != null && div.previousSibling.nodeName == "BUTTON");
            div.parentNode.removeChild(div.previousSibling);
        }
    }

    if(div.previousSibling == null){
        // テキストブロックが先頭にある場合

        if(div.nextSibling != null){
            // 後ろにテキストブロックがある場合

            // 後ろとの区切りを削除する。
            console.assert(div.nextSibling.nodeName == "HR");
            div.parentNode.removeChild(div.nextSibling);
        }
    }
    else{
        // テキストブロックが先頭でない場合

        // 直前との区切りを削除する。
        console.assert(div.previousSibling.nodeName == "HR");
        div.parentNode.removeChild(div.previousSibling);
    }

    // テキストブロックを削除する。
    div.parentNode.removeChild(div);
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

        case "SelectionAction":
            setSelection(act as SelectionAction);
            break;

        case "RemoveAction":
            removeTextBlock(act as RemoveAction);
            break;

        default:
            console.assert(false);
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

export function loadData(this_url : string){
    var k = this_url.lastIndexOf('/');
    var data_url = this_url.substring(0, k) + "/data/data.json";

    fetch(data_url)
    .then(function(response) {
        return response.json();
    })
    .then(function(json_data) {
        console.log(JSON.stringify(json_data));

        actions = json_data;
        for(let act of manebu.actions){
            addActionSummary(act);
        }
        play(0)
    });
}

export function actions_toJSON() : string {
    return "[\n" + actions.map(x => "\t" + JSON.stringify(x)).join("\n\t,\n") + "\n]";
}
}