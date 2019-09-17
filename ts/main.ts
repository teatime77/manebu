/// <reference path="speech.ts" />
/// <reference path="firebase.ts" />
namespace manebu {
declare let MathJax:any;
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

export let divActions : HTMLDivElement;
export let textMath : HTMLTextAreaElement;
export let divMath : HTMLDivElement;
let tmpSelection : SelectionAction | null = null;
export let inEditor : boolean;
export let ActionId = 0;
let divMsg : HTMLDivElement = null;
export let focusedActionIdx : number = -1;
const IDX = 0;
const NODE_NAME = 1;
export let allActions : Action[] = [];

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

export function getBlockId(blockId: number) : string {
    return `manebu-id-${blockId}`;
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
    const allJaxes = (MathJax.Hub.getAllJax() as ElementJax[]).map(x => x.root);

    const allDoms = allJaxes.map(x => getDomFromJax(x));

    const domsInSpan = allDoms.filter(x => getDomAncestors(x).includes(div) );

    const jaxesInSpan = domsInSpan.map(x => allJaxes[allDoms.indexOf(x)]);

    return jaxesInSpan;
}

function makeDomJaxMap(jaxes: JaxNode[]) : [Map<HTMLElement, JaxNode>, Map<JaxNode, HTMLElement>]{
    const dom2jax = new Map<HTMLElement, JaxNode>();
    const jax2dom = new Map<JaxNode, HTMLElement>();
    for(let ej of jaxes){
        for(let node of getJaxDescendants(ej)){

            let ele = getDomFromJax(node);
            dom2jax.set(ele, node);
            jax2dom.set(node, ele);
        }
    }

    return [dom2jax, jax2dom];
}

function getJaxPath(jaxIdx: number, jaxList:JaxNode[], maxNest: number) : any[]{
    const path : any[] = [];

    let parent = jaxList[0];

    path.push([jaxIdx, parent.nodeName]);

    for(let nest = 1; nest <= maxNest; nest++){
        let jax = jaxList[nest];
        let idx = parent.childNodes.indexOf(jax);
        console.assert(idx != -1);
        path.push([ idx, jax.nodeName]);
        parent = jax;
    }

    return path;
}

function getJaxFromPath(jaxes:JaxNode[], path:any[]) : JaxNode {
    let node = jaxes[path[0][IDX]];
    console.assert(node.nodeName == path[0][NODE_NAME])

    for(let obj of path.slice(1)){
        node = node.childNodes[obj[IDX]];
        console.assert(node.nodeName == obj[NODE_NAME])
    }

    return node;
}

function onclickBlock(div: HTMLDivElement, ev:MouseEvent){
    msg("clicked");

    if(tmpSelection != null){
        tmpSelection.disable();
        tmpSelection = null;
    }

    ev.stopPropagation();

    let mjxMath = null;
    for(let ele = ev.srcElement as HTMLElement;; ele = ele.parentNode as HTMLElement){

        if(ele.tagName != "SPAN"){
            break;
        }
        if(ele.className == "mjx-math"){
            mjxMath = ele;
            break;
        }
    }
    if(mjxMath == null){
        return;
    }

    const jaxes = getJaxesInBlock(div);
    const [dom2jax, jax2dom] = makeDomJaxMap(jaxes);

    function checkPath(text: string, path:any[], node2: JaxNode){
        msg(`${text}: ${path.map(x => `${x[IDX]}:${x[NODE_NAME]}`).join(',')}`);
        const node = getJaxFromPath(jaxes, path);
        console.assert(node == node2);
    }

    const sel = window.getSelection();
    
    if(sel.rangeCount == 1){

        const rng = sel.getRangeAt(0);

        msg(`start:${rng.startContainer.textContent} end:${rng.endContainer.textContent}`);

        const stAncs = getDomAncestors(rng.startContainer).filter(x => dom2jax.has(x)).map(x => dom2jax.get(x)).reverse();
        let jaxIdx;
        for(jaxIdx = 0; jaxIdx < jaxes.length; jaxIdx++){
            if(jaxes[jaxIdx] == stAncs[0]){
                break;
            }
        }

        msg(`all jax: ${jaxIdx}`);

        if(rng.startContainer == rng.endContainer){

            if(stAncs.length != 0){

                const startPath = getJaxPath(jaxIdx, stAncs, stAncs.length - 1);
                checkPath("path", startPath, last(stAncs));

                tmpSelection = new SelectionAction(getActionId(div.id), "math", startPath, null);
            }
        }
        else{

            const edAncs = getDomAncestors(rng.endContainer).filter(x => dom2jax.has(x)).map(x => dom2jax.get(x)).reverse();

            for(let nest = 0; nest < Math.min(stAncs.length, edAncs.length); nest++){
                if(stAncs[nest] != edAncs[nest]){

                    console.assert(nest != 0);

                    let parentJax = stAncs[nest - 1];

                    if(parentJax.nodeName == "msubsup"){

                        let startPath = getJaxPath(jaxIdx, stAncs, nest - 1);
                        checkPath("path", startPath, parentJax);

                        tmpSelection = new SelectionAction(getActionId(div.id), "math", startPath, null);
                    }
                    else{

                        let startPath = getJaxPath(jaxIdx, stAncs, nest);
                        let endPath   = getJaxPath(jaxIdx, edAncs, nest);

                        checkPath("path1", startPath, stAncs[nest]);
                        checkPath("path2", endPath  , edAncs[nest]);

                        tmpSelection = new SelectionAction(getActionId(div.id), "math", startPath, endPath);
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

        allActions.push(this);
    }

    toObj(){
        if(actionMap.has(this.id)){
            return { ref: this.id };
        }
        actionMap.set(this.id, this);
        
        const obj = { typeName: this.getTypeName(), id: this.id };

        if(this instanceof CompositeShape){
            Object.assign(obj, { handles : this.handles.map(x => x.toObj()) });
        }

        this.makeObj(obj);

        return obj;
    }

    makeObj(obj){
    }

    getTypeName(){
        return this.constructor.name;
    }

    init(){        
    }

    *restore():any{}

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
        return this.getTypeName();
    }

    summaryDom() : HTMLSpanElement {
        const span = document.createElement("span");
        span.dataset.id = "" + this.id;
        span.textContent = this.summary();
        span.tabIndex = 0;
        span.style.whiteSpace = "nowrap";
        span.addEventListener("keydown", function(ev:KeyboardEvent){
            if(ev.key == "ArrowDown" || ev.key == "ArrowUp"){
                console.log(`key down:${ev.key}`);

                ev.stopPropagation();
                ev.preventDefault();

                const spans = Array.from(divActions.childNodes) as HTMLSpanElement[];
                const idx = spans.indexOf(this);
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
            const spans = Array.from(divActions.childNodes) as HTMLSpanElement[];
            const idx = spans.indexOf(this);
            console.assert(idx != -1);
    
            if(focusedActionIdx == -1){
                for(let [i, act] of actions.entries()){
                    act.setEnable(i <= idx);
                }
            }
            else{
                const minIdx = Math.min(idx, focusedActionIdx);
                const maxIdx = Math.max(idx, focusedActionIdx);
                for(let i = minIdx; i <= maxIdx; i++){
                    actions[i].setEnable(i <= idx);
                }
            }

            divMath.scrollTop = divMath.scrollHeight;
    
            focusedActionIdx = idx;

            const act = actions[focusedActionIdx];
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

export let actions : Action[] = [];
export let selections : SelectionAction[] = [];

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
        let nextEle = null;
        if(focusedActionIdx != -1){

            for(let act of actions.slice(focusedActionIdx + 1)){
                if(act instanceof DivAction){
                    nextEle = act.div;
                    break;
                }
            }
        }
        const div = document.createElement("div");
        div.className = "manebu-text-block";
    
        div.id = getBlockId(this.id);
        div.title = div.id
    
        divMath.insertBefore(div, nextEle);
    
        div.tabIndex = 0;
    
        const html = makeHtmlLines(text);
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
            onclickBlock(this, ev);
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
    blockId: number;
    domType: string;
    startPath:any[];
    endPath:any[] | null;
    selectedDoms : HTMLElement[];
    isTmp: boolean = false;

    constructor(blockId: number, domType:string, startPath:any[], endPath:any[] | null){
        super();
        this.blockId = blockId;
        this.domType = domType;
        this.startPath = startPath;
        this.endPath   = endPath;
    }

    makeObj(obj){
        Object.assign(obj, {
            blockId: this.blockId ,
            domType: this.domType ,
            startPath: this.startPath,
            endPath: this.endPath 
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
        console.assert(this.domType == "math");

        this.selectedDoms = [];
    
        const div = document.getElementById(getBlockId(this.blockId)) as HTMLDivElement;
        const jaxes = getJaxesInBlock(div);
    
        const startJax = getJaxFromPath(jaxes, this.startPath);
        const startIdx = last(this.startPath)[IDX];
    
        const parentJax = startJax.parent;
        console.assert(getJaxIndex(startJax) == startIdx);
        console.assert(startJax.nodeName == last(this.startPath)[NODE_NAME])
    
        if(this.endPath == null){
    
            this.selectedDoms.push(getDomFromJax(startJax));
        }
        else{
    
            const endJax = getJaxFromPath(jaxes, this.endPath);
    
            const endIdx = last(this.endPath)[IDX];
    
            console.assert(getJaxIndex(endJax) == endIdx);
            console.assert(endJax.nodeName == last(this.endPath)[NODE_NAME])
        
            const nodes = parentJax.childNodes.slice(startIdx, endIdx + 1);
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

        const delEle = document.getElementById(getBlockId(this.id));
        if(inEditor){

            delEle.style.backgroundColor = "gainsboro";
        }
        else{

            delEle.style.display = "none";
        }

    }

    summary() : string {
        return "終了";
    }
}

export class ImgAction extends Action {
    image: Image;
    fileName: string;

    constructor(fileName: string){
        super();
        this.fileName = fileName;
    }

    init(){
        this.image = new Image(this.fileName);
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
            
    const nextEle = divActions.children[focusedActionIdx].nextElementSibling;
    if(nextEle == null){

        divActions.appendChild(act.summaryDom());
    }
    else{

        divActions.insertBefore(act.summaryDom(), nextEle);
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
    const act = actions[focusedActionIdx] as TextBlockAction;

    const html = makeHtmlLines(textMath.value);
    act.div.innerHTML = html;
    act.text = textMath.value;

    divActions.children[focusedActionIdx].textContent = act.summary();

    reprocessMathJax(html);
}

function monitorTextMath(){
    let timerId = -1;

    textMath.addEventListener("focus", function(){
        console.assert(0 <= focusedActionIdx && focusedActionIdx < actions.length && actions[focusedActionIdx].constructor == TextBlockAction);
        const act1 = actions[focusedActionIdx] as TextBlockAction;

        textMath.value = act1.text;
        let prevValue = textMath.value;
        timerId = setInterval(function(){
            if(prevValue == textMath.value){
                return;
            }

            prevValue = textMath.value;

            updateFocusedTextBlock();
        }, 100);
    });

    textMath.addEventListener("blur", function(){
        clearInterval(timerId);

        if(textMath.value.trim() == ""){
            const act = actions[focusedActionIdx] as TextBlockAction;

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

            updateFocusedTextBlock();

            textMath.value = "";

            const act = new TextBlockAction("");
            addAction(act);
        
            act.init();        

            focusedActionIdx++;
        }
    });
}

export function initManebu(in_editor: boolean){
    inEditor = in_editor;
    divMsg = document.getElementById("div-msg") as HTMLDivElement;
    divMath = document.getElementById("div-math") as HTMLDivElement;
    divActions = document.getElementById("div-actions") as HTMLDivElement;

    msg("body loaded");

    initFirebase();
    initSpeech();

    if(! inEditor){
        return;
    }

    textMath = document.getElementById("txt-math") as HTMLTextAreaElement;
    textMath.disabled = false;

    const act = new TextBlockAction("");
    actions.push(act);
    divActions.appendChild(act.summaryDom());

    focusedActionIdx = 0;
    act.init();

    monitorTextMath();
}

}