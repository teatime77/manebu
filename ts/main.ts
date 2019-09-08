/// <reference path="speech.ts" />
/// <reference path="firebase.ts" />
namespace manebu {
declare var MathJax:any;
class JaxNode {
    CHTMLnodeID: number;
    nodeName: string;
    parent: JaxNode;
    childNodes: JaxNode[];
}

class ElementJax {
    root : JaxNode;
    Rerender(){}
}

var selected_mjx : HTMLElement[] = [];
export var divActions : HTMLDivElement;
export var textMath : HTMLTextAreaElement;
export var divMath : HTMLDivElement;
var tmpSelection : SelectionAction | null = null;
export var inEditor : boolean;
export var ActionId = 0;
var textMathSelectionStart : number = 0;
var textMathSelectionEnd : number = 0;
var divMsg : HTMLDivElement = null;
var invBlocks : HTMLDivElement[] = [];
var changeTime : number = 0;
const IDX = 0;
const NODE_NAME = 1;

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

export function getBlockId(block_id: number) : string {
    return `manebu-id-${block_id}`;
}

export function getActionId(id: string) : number {
    console.assert(id.startsWith("manebu-id-"));
    return parseInt(id.substring(10));
}

function set_current_mjx(node : HTMLElement, is_tmp: boolean){
    if(! selected_mjx.includes(node)){

        selected_mjx.push(node);

        if(is_tmp){

            // node.style.color = "#00CC00";
            node.style.color = "#8080FF";
            // node.style.textDecoration = "wavy underline red"
            node.style.backgroundColor = "#C0C0C0";
        }
        else{

            node.style.color = "red";
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

function* getJaxDescendants(node:JaxNode){
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

function getDomAncestors(node: Node) : HTMLElement[] {
    function* fnc(node: Node){
        for(let nd = node.parentElement; nd != null; nd = nd.parentElement){
            yield nd;
        }
    }

    return Array.from(fnc(node));
}

function getDomFromJax(node: JaxNode) : HTMLElement{
    return document.getElementById(`MJXc-Node-${node.CHTMLnodeID}`);
}

function getJaxIndex(node){
    return node.parent.childNodes.indexOf(node);
}

function getJaxesInBlock(div: HTMLDivElement) : JaxNode[]{
    var all_jaxes = (MathJax.Hub.getAllJax() as ElementJax[]).map(x => x.root);

    var all_doms = all_jaxes.map(x => getDomFromJax(x));

    var doms_in_span = all_doms.filter(x => getDomAncestors(x).includes(div) );

    var jaxes_in_span = doms_in_span.map(x => all_jaxes[all_doms.indexOf(x)]);

    return jaxes_in_span;
}

function makeDomJaxMap(jaxes: JaxNode[]) : [Map<HTMLElement, JaxNode>, Map<JaxNode, HTMLElement>]{
    var dom2jax = new Map<HTMLElement, JaxNode>();
    var jax2dom = new Map<JaxNode, HTMLElement>();
    for(let ej of jaxes){
        for(let node of getJaxDescendants(ej)){

            var ele = getDomFromJax(node);
            dom2jax.set(ele, node);
            jax2dom.set(node, ele);
        }
    }

    return [dom2jax, jax2dom];
}

function getJaxPath(jax_idx: number, jax_list:JaxNode[], max_nest: number) : any[]{
    var path : any[] = [];

    var parent = jax_list[0];

    path.push([jax_idx, parent.nodeName]);

    for(var nest = 1; nest <= max_nest; nest++){
        var jax = jax_list[nest];
        var idx = parent.childNodes.indexOf(jax);
        console.assert(idx != -1);
        path.push([ idx, jax.nodeName]);
        parent = jax;
    }

    return path;
}

function getJaxFromPath(jaxes:JaxNode[], path:any[]) : JaxNode {
    var node = jaxes[path[0][IDX]];
    console.assert(node.nodeName == path[0][NODE_NAME])

    for(let obj of path.slice(1)){
        node = node.childNodes[obj[IDX]];
        console.assert(node.nodeName == obj[NODE_NAME])
    }

    return node;
}

function onclick_block(div: HTMLDivElement, ev:MouseEvent){
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

    var jaxes = getJaxesInBlock(div);
    var [dom2jax, jax2dom] = makeDomJaxMap(jaxes);

    function check_path(text: string, path:any[], node_sv: JaxNode){
        msg(`${text}: ${path.map(x => `${x[IDX]}:${x[NODE_NAME]}`).join(',')}`);
        var node = getJaxFromPath(jaxes, path);
        console.assert(node == node_sv);
    }

    var sel = window.getSelection();
    
    if(sel.rangeCount == 1){

        var rng = sel.getRangeAt(0);

        msg(`start:${rng.startContainer.textContent} end:${rng.endContainer.textContent}`);

        var st_a = getDomAncestors(rng.startContainer).filter(x => dom2jax.has(x)).map(x => dom2jax.get(x)).reverse();
        var jax_idx;
        for(jax_idx = 0; jax_idx < jaxes.length; jax_idx++){
            if(jaxes[jax_idx] == st_a[0]){
                break;
            }
        }

        msg(`all jax: ${jax_idx}`);

        if(rng.startContainer == rng.endContainer){

            if(st_a.length != 0){

                var start_path = getJaxPath(jax_idx, st_a, st_a.length - 1);
                check_path("path", start_path, last(st_a));

                tmpSelection = new SelectionAction(getActionId(div.id), "math", start_path, null);
            }
        }
        else{

            var ed_a = getDomAncestors(rng.endContainer).filter(x => dom2jax.has(x)).map(x => dom2jax.get(x)).reverse();

            for(var nest = 0; nest < Math.min(st_a.length, ed_a.length); nest++){
                if(st_a[nest] != ed_a[nest]){

                    console.assert(nest != 0);

                    var parent_jax = st_a[nest - 1];

                    if(parent_jax.nodeName == "msubsup"){

                        var start_path = getJaxPath(jax_idx, st_a, nest - 1);
                        check_path("path", start_path, parent_jax);

                        tmpSelection = new SelectionAction(getActionId(div.id), "math", start_path, null);
                    }
                    else{

                        var start_path = getJaxPath(jax_idx, st_a, nest);
                        var end_path   = getJaxPath(jax_idx, ed_a, nest);

                        check_path("path1", start_path, st_a[nest]);
                        check_path("path2", end_path  , ed_a[nest]);

                        tmpSelection = new SelectionAction(getActionId(div.id), "math", start_path, end_path);
                    }
                    break;
                }
            }
        }

        if(tmpSelection != null){
            setSelection(tmpSelection, true);
        }
    }

    window.getSelection().removeAllRanges();
}

export class Action {
    action_id: number;
    class_name: string;

    constructor(){
        this.action_id = ActionId;
        ActionId++;

        this.class_name = this.constructor.name;
    }

    *play(fast_forward: boolean){
        console.assert(false);
        yield;
    }

    summary() : string {
        console.assert(false);
        return "";
    }

    summaryDom() : HTMLSpanElement {
        var span = document.createElement("span");
        span.innerText = this.summary();
        span.tabIndex = 0;
        span.addEventListener("keydown", function(ev:KeyboardEvent){
            if(ev.key == "ArrowDown" || ev.key == "ArrowUp"){
                console.log(`key down:${ev.key}`);

                ev.stopPropagation();
                ev.preventDefault();

                var spans = Array.from(divActions.childNodes) as HTMLSpanElement[];
                var idx = spans.indexOf(this);
                console.assert(idx != -1);
                if(ev.key == "ArrowDown"){

                    if(idx + 1 < spans.length){
                        spans[idx + 1].focus();
                    }
                }
                else{
                    if(0 < idx){
                        spans[idx - 1].focus();
                    }
                }
            }
        });

        return span;
    }
    
}

export var actions : Action[] = [];

function makeTextDiv(action_id:number, text: string) : HTMLDivElement {
    var div = document.createElement("div");
    div.className = "manebu-text-block";

    div.id = getBlockId(action_id);
    div.title = div.id

    divMath.insertBefore(div, null);

    div.tabIndex = 0;

    div.innerHTML = make_html_lines(text);

    return div;
}

export class TextBlockAction extends Action {
    lines: string[];

    constructor(lines: string[]){
        super();
        this.lines = lines;
    }

    *play(fast_forward: boolean){
        var text = this.lines.join('\n');

        msg(`append text block[${text}]`);
    
        typeset_ended = false;

        var div = makeTextDiv(this.action_id, text);
        div.addEventListener("click", function(ev:MouseEvent){
            onclick_block(this, ev);
        });
    
        div.addEventListener('keydown', (event) => {
            msg(`key down ${event.key} ${event.ctrlKey}`);
        }, false);        
    
        if(! fast_forward){
    
            MathJax.Hub.Queue(["Typeset",MathJax.Hub]);
            MathJax.Hub.Queue([ontypeset, "append", 123]);
    
            while(! typeset_ended){
                yield;
            }
        }
    }

    summary() : string {
        return `テキスト ${this.lines[0]}`;
    }
}

export class SpeechAction extends Action {
    text: string;

    constructor(text: string){
        super();
        this.text = text;
    }

    *play(fast_forward: boolean){
        if(! fast_forward){

            yield* speak(this.text);
        }
        makeTextDiv(this.action_id, this.text);
    }

    summary() : string {
        return `音声 ${this.text}`;
    }
}

export class SelectionAction extends Action {
    block_id: number;
    dom_type: string;
    start_path:any[];
    end_path:any[] | null;

    constructor(block_id: number, dom_type:string, start_path:any[], end_path:any[] | null){
        super();
        this.block_id = block_id;
        this.dom_type = dom_type;
        this.start_path = start_path;
        this.end_path   = end_path;
    }

    *play(fast_forward: boolean){
        if(! fast_forward){
                    
            setSelection(this, false);
        }
    }

    summary() : string {
        return "選択";
    }
}

export class UnselectionAction extends Action {
    constructor(){
        super();
    }

    *play(fast_forward: boolean){
        if(! fast_forward){
                
            restore_current_mjx_color();
        }
    }

    summary() : string {
        return "非選択";
    }
}

export class EndAction extends Action {
    constructor(action_id: number){
        super();
    }

    *play(fast_forward: boolean){

        var del_ele = document.getElementById(getBlockId(this.action_id));
        if(inEditor){

            del_ele.style.backgroundColor = "gainsboro";
        }
        else{

            del_ele.style.display = "none";
        }

    }

    summary() : string {
        return "終了";
    }
}

export class ImgAction extends Action {
    file_name: string;

    constructor(file_name: string){
        super();
        this.file_name = file_name;
    }

    *play(fast_forward: boolean){
        addSVG(this.file_name, null);
    }

    summary() : string {
        return "画像";
    }
}

export class ShapeAction extends Action {
    cmd: string;
    data: ShapeData;

    constructor(cmd: string, data: ShapeData){
        super();
        this.cmd = cmd;
        this.data = data;
    }

    *play(fast_forward: boolean){
        addShapeFromData(this.cmd, this.data);
    }

    summary() : string {
        return "図形";
    }
}

var typeset_ended = false;
function ontypeset(text: string, id: number){
    msg(`${text} ${id}`);

    typeset_ended = true;

    divMath.scrollTop = divMath.scrollHeight;
}

export function insertText(ins_str: string){
    textMath.value = textMath.value.substring(0, textMathSelectionEnd) + ins_str + textMath.value.substring(textMathSelectionEnd);

    textMathSelectionStart += ins_str.length;
    textMathSelectionEnd += ins_str.length;
}

export function addSelection(){
    if(tmpSelection == null){
        return;
    }

    restore_current_mjx_color();

    var ins_str = '@select ' + JSON.stringify(tmpSelection) + '\n';
    insertText(ins_str);

    setSelection(tmpSelection, false);
}

export function setSelection(act: SelectionAction, is_tmp: boolean){
    console.assert(act.dom_type == "math");

    var div = document.getElementById(getBlockId(act.block_id)) as HTMLDivElement;
    var jaxes = getJaxesInBlock(div);

    var start_jax = getJaxFromPath(jaxes, act.start_path);
    var st_i = last(act.start_path)[IDX];

    var parent_jax = start_jax.parent;
    console.assert(getJaxIndex(start_jax) == st_i);
    console.assert(start_jax.nodeName == last(act.start_path)[NODE_NAME])

    if(act.end_path == null){

        set_current_mjx(getDomFromJax(start_jax), is_tmp);
    }
    else{

        var end_jax = getJaxFromPath(jaxes, act.end_path);

        var ed_i = last(act.end_path)[IDX];

        console.assert(getJaxIndex(end_jax) == ed_i);
        console.assert(end_jax.nodeName == last(act.end_path)[NODE_NAME])
    
        var nodes = parent_jax.childNodes.slice(st_i, ed_i + 1);
        for(let nd of nodes){

            if(nd != null){

                set_current_mjx(getDomFromJax(nd), is_tmp);
            }
        }    
    }
}


export function init_manebu(in_editor: boolean){
    inEditor = in_editor;
    divMsg = document.getElementById("div-msg") as HTMLDivElement;
    divMath = document.getElementById("div-math") as HTMLDivElement;
    divActions = document.getElementById("div-actions") as HTMLDivElement;

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

}