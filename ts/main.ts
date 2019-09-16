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

export var divActions : HTMLDivElement;
export var textMath : HTMLTextAreaElement;
export var divMath : HTMLDivElement;
var tmpSelection : SelectionAction | null = null;
export var inEditor : boolean;
export var ActionId = 0;
var divMsg : HTMLDivElement = null;
export var focusedActionIdx : number = -1;
const IDX = 0;
const NODE_NAME = 1;
export var all_actions : Action[] = [];

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

    if(tmpSelection != null){
        tmpSelection.disable();
        tmpSelection = null;
    }

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
            tmpSelection.isTmp = true;
            tmpSelection.setSelectedDoms();
            tmpSelection.enable();
        }
    }

    window.getSelection().removeAllRanges();
}

export class Action {
    id: number;

    constructor(){
        this.id = ActionId;
        ActionId++;

        all_actions.push(this);
    }

    toObj(){
        if(actionMap.has(this.id)){
            return { ref: this.id };
        }
        actionMap.set(this.id, this);
        
        var obj = { type_name: this.typeName(), id: this.id };
        
        if(this instanceof CompositeShape){
            Object.assign(obj, { handles : this.handles.map(x => x.toObj()) });
        }

        this.makeObj(obj);

        return obj;
    }

    makeObj(obj){
    }

    typeName(){
        return this.constructor.name;
    }

    init(){        
    }

    *restore(){}

    enable(){
    }

    disable(){
    }

    setEnable(enable: boolean){
        if(enable){
            this.enable();
        }
        else{
            this.disable();
        }
    }

    *play(){
        yield;
    }

    summary() : string {
        return this.typeName();
    }

    summaryDom() : HTMLSpanElement {
        var span = document.createElement("span");
        span.dataset.id = "" + this.id;
        span.textContent = this.summary();
        span.tabIndex = 0;
        span.style.whiteSpace = "nowrap";
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

        span.addEventListener("focus", function(ev:FocusEvent){
            msg("focus");
            var spans = Array.from(divActions.childNodes) as HTMLSpanElement[];
            var idx = spans.indexOf(this);
            console.assert(idx != -1);
    
            if(focusedActionIdx == -1){
                for(let [i, act] of actions.entries()){
                    act.setEnable(i <= idx);
                }
            }
            else{
                var min_idx = Math.min(idx, focusedActionIdx);
                var max_idx = Math.max(idx, focusedActionIdx);
                for(var i = min_idx; i <= max_idx; i++){
                    actions[i].setEnable(i <= idx);
                }
            }

            divMath.scrollTop = divMath.scrollHeight;
    
            focusedActionIdx = idx;

            var act = actions[focusedActionIdx];
            if(act.constructor == TextBlockAction){
                textMath.value = (act as TextBlockAction).text;
            }
            else{
                textMath.value = "";
            }
        });
    
        return span;
    }
}

export var actions : Action[] = [];
export var selections : SelectionAction[] = [];

class DivAction extends Action {
    text: string;
    div: HTMLDivElement;

    enable(){
        this.div.style.display = "block";
    }

    disable(){
        this.div.style.display = "none";
    }

    makeTextDiv(text: string) : HTMLDivElement {
        var next_ele = null;
        if(focusedActionIdx != -1){

            for(let act of actions.slice(focusedActionIdx + 1)){
                if(act instanceof DivAction){
                    next_ele = act.div;
                    break;
                }
            }
        }
        var div = document.createElement("div");
        div.className = "manebu-text-block";
    
        div.id = getBlockId(this.id);
        div.title = div.id
    
        divMath.insertBefore(div, next_ele);
    
        div.tabIndex = 0;
    
        var html = make_html_lines(text);
        div.innerHTML = html;
        reprocessMathJax(html);
    
        return div;
    }
}

export class TextBlockAction extends DivAction {
    constructor(text: string){
        super();
        this.text = text;
        //---------- 
        msg(`append text block[${this.text}]`);
    
        this.div = this.makeTextDiv(this.text);
        this.div.addEventListener("click", function(ev:MouseEvent){
            onclick_block(this, ev);
        });
    
        this.div.addEventListener('keydown', (event) => {
            msg(`key down ${event.key} ${event.ctrlKey}`);
        }, false);        
    }

    makeObj(obj){
        Object.assign(obj, { text: this.text });
    }

    summary() : string {
        return `t ${this.id} ${this.text.split('\n').filter(x => x.trim() != "$$").join(' ').substring(0, 10)}`;
    }
}

export class SpeechAction extends DivAction {
    constructor(text: string){
        super();
        this.text = text;
        //---------- 
        this.div = this.makeTextDiv(this.text);
    }

    makeObj(obj){
        Object.assign(obj, { text: this.text });
    }

    *play(){
        yield* speak(this.text);
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
    selectedDoms : HTMLElement[];
    isTmp: boolean = false;

    constructor(block_id: number, dom_type:string, start_path:any[], end_path:any[] | null){
        super();
        this.block_id = block_id;
        this.dom_type = dom_type;
        this.start_path = start_path;
        this.end_path   = end_path;
    }

    makeObj(obj){
        Object.assign(obj, {
            block_id: this.block_id ,
            dom_type: this.dom_type ,
            start_path: this.start_path,
            end_path: this.end_path 
        });
    }

    init(){
        selections.push(this);
    }

    enable(){
        this.setSelectedDoms();
        for(let dom of this.selectedDoms){

            if(this.isTmp){

                // node.style.color = "#00CC00";
                dom.style.color = "#8080FF";
                // node.style.textDecoration = "wavy underline red"
                dom.style.backgroundColor = "#C0C0C0";
            }
            else{
    
                dom.style.color = "red";
            }
        }
    }

    disable(){
        this.setSelectedDoms();
        for(let dom of this.selectedDoms){
            dom.style.color = "unset";
            dom.style.backgroundColor = "unset";
        }    
    }

    summary() : string {
        return "選択";
    }

    setSelectedDoms(){
        console.assert(this.dom_type == "math");

        this.selectedDoms = [];
    
        var div = document.getElementById(getBlockId(this.block_id)) as HTMLDivElement;
        var jaxes = getJaxesInBlock(div);
    
        var start_jax = getJaxFromPath(jaxes, this.start_path);
        var st_i = last(this.start_path)[IDX];
    
        var parent_jax = start_jax.parent;
        console.assert(getJaxIndex(start_jax) == st_i);
        console.assert(start_jax.nodeName == last(this.start_path)[NODE_NAME])
    
        if(this.end_path == null){
    
            this.selectedDoms.push(getDomFromJax(start_jax));
        }
        else{
    
            var end_jax = getJaxFromPath(jaxes, this.end_path);
    
            var ed_i = last(this.end_path)[IDX];
    
            console.assert(getJaxIndex(end_jax) == ed_i);
            console.assert(end_jax.nodeName == last(this.end_path)[NODE_NAME])
        
            var nodes = parent_jax.childNodes.slice(st_i, ed_i + 1);
            for(let nd of nodes){
    
                if(nd != null){
    
                    this.selectedDoms.push(getDomFromJax(nd));
                }
            }    
        }
    }
}

export class UnselectionAction extends Action {
    unselections : SelectionAction[] = null;

    constructor(){
        super();
    }

    init(){
        this.unselections = selections;
        selections = [];
    }


    enable(){
        for(let act of this.unselections){
            act.disable();
        }
    }

    disable(){
        for(let act of this.unselections){
            act.enable();
        }
    }

    summary() : string {
        return "非選択";
    }
}

export class EndAction extends Action {
    constructor(id: number){
        super();
    }

    *play(){

        var del_ele = document.getElementById(getBlockId(this.id));
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
    image: Image;
    file_name: string;

    constructor(file_name: string){
        super();
        this.file_name = file_name;
    }

    init(){
        this.image = new Image(this.file_name);
    }

    *play(){
    }

    summary() : string {
        return "画像";
    }
}

export class ShapeAction extends Action {
    constructor(cmd: string, data: any){
        super();
    }

    init(){        
    }

    *play(){
    }

    summary() : string {
        return "図形";
    }
}

function addAction(act: Action){
    actions.splice(focusedActionIdx + 1, 0, act);
            
    var next_ele = divActions.children[focusedActionIdx].nextElementSibling;
    if(next_ele == null){

        divActions.appendChild(act.summaryDom());
    }
    else{

        divActions.insertBefore(act.summaryDom(), next_ele);
    }
}

export function addSelection(){
    if(tmpSelection == null){
        return;
    }

    tmpSelection.isTmp = false;
    tmpSelection.enable();
    addAction(tmpSelection);

    tmpSelection = null;
}

function reprocessMathJax(html: string){
    if(html.split('\n').some(x => x.trim() == "$$")){
        MathJax.Hub.Queue(["Typeset",MathJax.Hub]);
    }
}

function updateFocusedTextBlock(){
    var act = actions[focusedActionIdx] as TextBlockAction;

    var html = make_html_lines(textMath.value);
    act.div.innerHTML = html;
    act.text = textMath.value;

    divActions.children[focusedActionIdx].textContent = act.summary();

    reprocessMathJax(html);
}

function monitorTextMath(){
    var timer_id = -1;

    textMath.addEventListener("focus", function(){
        console.assert(0 <= focusedActionIdx && focusedActionIdx < actions.length && actions[focusedActionIdx].constructor == TextBlockAction);
        var act1 = actions[focusedActionIdx] as TextBlockAction;

        textMath.value = act1.text;
        var prev_value = textMath.value;
        timer_id = setInterval(function(){
            if(prev_value == textMath.value){
                return;
            }

            prev_value = textMath.value;

            updateFocusedTextBlock();
        }, 100);
    });

    textMath.addEventListener("blur", function(){
        clearInterval(timer_id);

        if(textMath.value.trim() == ""){
            var act = actions[focusedActionIdx] as TextBlockAction;

            actions.splice(focusedActionIdx, 1);
            divMath.removeChild(act.div);
            divActions.removeChild(divActions.children[focusedActionIdx]);
            
            if(focusedActionIdx == ActionId - 1){
                ActionId--;
            }
            focusedActionIdx = -1;
        }
        else{

            updateFocusedTextBlock();
        }
    });

    textMath.addEventListener("keypress", function(ev:KeyboardEvent){
        msg(`key press ${ev.ctrlKey} ${ev.key}`);
        console.assert(focusedActionIdx != -1);
        if(ev.ctrlKey && ev.code == "Enter"){

            var act = actions[focusedActionIdx] as TextBlockAction;

            updateFocusedTextBlock();

            textMath.value = "";

            var act = new TextBlockAction("");
            addAction(act);
        
            act.init();        

            focusedActionIdx++;
        }
    });
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
    textMath.disabled = false;

    var act = new TextBlockAction("");
    actions.push(act);
    divActions.appendChild(act.summaryDom());

    focusedActionIdx = 0;
    act.init();

    monitorTextMath();
}

}