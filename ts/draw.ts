/// <reference path="util.ts" />
/// <reference path="main.ts" />
namespace manebu{

const infinity = 20;
const strokeWidth = 4;
const thisStrokeWidth = 2;
const gridLineWidth = 1;

declare let MathJax:any;
let tblProperty : HTMLTableElement;
let angleDlg : HTMLDialogElement;
let angleDlgOk : HTMLInputElement;
let angleDlgColor : HTMLInputElement;
let view : View;

function initPoint(pt:Vec2){
    const point = new Point().make({pos:pt});
    point.init();

    return point;
}

function initLineSegment(){
    const line = new LineSegment();
    line.init();

    return line;
}

function getSvgPos(pt: Vec2) : Vec2 {
    const rc1 = view.svg.getBoundingClientRect() as DOMRect;
    const rc2 = view.div.getBoundingClientRect() as DOMRect;

    console.assert(rc1.x == rc2.x && rc1.y == rc2.y && rc1.width == rc2.width && rc1.height == rc2.height);

    const x = view.svg.viewBox.baseVal.x + view.svg.viewBox.baseVal.width  * pt.x / rc1.width;
    const y = view.svg.viewBox.baseVal.y + view.svg.viewBox.baseVal.height * pt.y / rc1.height;

    return new Vec2(x, y);
}


function toSvgRatio() : Vec2 {
    const rc1 = view.svg.getBoundingClientRect() as DOMRect;
    const rc2 = view.div.getBoundingClientRect() as DOMRect;

    console.assert(rc1.x == rc2.x && rc1.y == rc2.y && rc1.width == rc2.width && rc1.height == rc2.height);

    return new Vec2(view.svg.viewBox.baseVal.width / rc1.width, view.svg.viewBox.baseVal.height / rc1.height) ;
}



function getSvgPoint(ev: MouseEvent | PointerEvent, draggedPoint: Point|null){
	const point = view.svg.createSVGPoint();
	
    //画面上の座標を取得する．
    point.x = ev.offsetX;
    point.y = ev.offsetY;

    const p = getSvgPos(new Vec2(ev.offsetX, ev.offsetY));
    if(view.CTMInv != undefined){

        //座標に逆行列を適用する．
        const p2 = point.matrixTransform(view.CTMInv);
        console.assert(Math.abs(p.x - p2.x) < 0.01 && Math.abs(p.y - p2.y) < 0.01)
        // msg(`dom->svg (${p.x} , ${p.y}) (${p2.x} , ${p2.y})`)
    }


    if(view.flipY){

        p.y = - p.y;
    }

    if(view.snapToGrid){

        const ele = document.elementFromPoint(ev.clientX, ev.clientY);
        if(ele == view.svg || ele == view.gridBg || (draggedPoint != null && ele == draggedPoint.circle)){
            p.x = Math.round(p.x / view.gridWidth ) * view.gridWidth;
            p.y = Math.round(p.y / view.gridHeight) * view.gridHeight;
        }
    }

    return new Vec2(p.x, p.y);
}

function clickHandle(ev: MouseEvent, pt:Vec2) : Point{
    let handle = getPoint(ev);
    if(handle == null){

        const line = getLine(ev);
        if(line != null){

            handle = initPoint(pt);
            line.adjust(handle);

            line.bind(handle)
        }
        else{
            const circle = getCircle(ev);
            if(circle != null){

                handle = initPoint(pt);
                circle.adjust(handle);

                circle.bind(handle)
            }
            else{

                handle = initPoint(pt);
            }
        }
    }
    else{
        handle.select(true);
    }

    return handle;
}

function zip(v1:any[], v2:any[]):any[]{
    const v = [];
    const minLen = Math.min(v1.length, v2.length);
    for(let i = 0; i < minLen; i++){
        v.push([v1[i], v2[i]])
    }

    return v;
}


function getPoint(ev: MouseEvent) : Point | null{
    const pt = Array.from(view.shapes.values()).find(x => x.constructor.name == "Point" && (x as Point).circle == ev.target) as (Point|undefined);
    return pt == undefined ? null : pt;
}

function getLine(ev: MouseEvent) : LineSegment | null{
    const line = Array.from(view.shapes.values()).find(x => x instanceof LineSegment && (x as LineSegment).line == ev.target && (x as LineSegment).handles.length == 2) as (LineSegment|undefined);
    return line == undefined ? null : line;
}

function getCircle(ev: MouseEvent) : Circle | null{
    const circle = Array.from(view.shapes.values()).find(x => x.constructor.name == "Circle" && (x as Circle).circle == ev.target && (x as Circle).handles.length == 2) as (Circle|undefined);
    return circle == undefined ? null : circle;
}

function linesIntersection(l1:LineSegment, l2:LineSegment) : Vec2 {
    l1.setVecs();
    l2.setVecs();

    /*
    l1.p1 + u l1.p12 = l2.p1 + v l2.p12

    l1.p1.x + u l1.p12.x = l2.p1.x + v l2.p12.x
    l1.p1.y + u l1.p12.y = l2.p1.y + v l2.p12.y

    l1.p12.x, - l2.p12.x   u = l2.p1.x - l1.p1.x
    l1.p12.y, - l2.p12.y   v = l2.p1.y - l1.p1.y
    
    */
    const m = new Mat2(l1.p12.x, - l2.p12.x, l1.p12.y, - l2.p12.y);
    const v = new Vec2(l2.p1.x - l1.p1.x, l2.p1.y - l1.p1.y);
    const mi = m.inv();
    const uv = mi.dot(v);
    const u = uv.x;

    return l1.p1.add(l1.p12.mul(u));
}

function calcFootOfPerpendicular(pos:Vec2, line: LineSegment) : Vec2 {
    const p1 = line.handles[0].pos;
    const p2 = line.handles[1].pos;

    const e = p2.sub(p1).unit();
    const v = pos.sub(p1);
    const h = e.dot(v);

    const foot = p1.add(e.mul(h));

    return foot;
}


function setToolType(){
    const textBoxes = actions.filter(x => x instanceof TextBox) as TextBox[];

    view.toolType = (document.querySelector('input[name="tool-type"]:checked') as HTMLInputElement).value;

    if(view.toolType == "TextSelection"){

        textBoxes.forEach(x => x.div.style.zIndex = "auto");
    }
    else{

        textBoxes.forEach(x => x.div.style.zIndex = "-1");
    }
    if(view.toolType == "select"){

        textBoxes.forEach(x => x.div.style.cursor = "move");
    }
    else if(view.toolType == "TextSelection"){

        textBoxes.forEach(x => x.div.style.cursor = "text");
    }
    else{

        textBoxes.forEach(x => x.div.style.cursor = "default");
    }
}

function makeToolByType(toolType: string): Shape|undefined {
    const v = toolType.split('.');
    const typeName = v[0];
    const arg = v.length == 2 ? v[1] : null;

    switch(typeName){
        case "Point":         return new Point().make({pos:new Vec2(0,0)});
        case "LineSegment":  return new LineSegment();
        case "Rect":          return new Rect().make({isSquare:(arg == "2")}) as Shape;
        case "Circle":       return new Circle().make({byDiameter:(arg == "2")}) as Shape;
        case "DimensionLine": return new DimensionLine();
        case "Triangle":      return new Triangle();
        case "Midpoint":      return new Midpoint();
        case "Perpendicular": return new Perpendicular()
        case "ParallelLine": return new ParallelLine()
        case "Intersection":  return new Intersection();
        case "Angle":         return new Angle();
        case "TextBox":      return new TextBox();
        case "Label":           return new Label().make({text:"こんにちは"}) as Shape;
    } 
}

function showProperty(obj: any){
    const proto = Object.getPrototypeOf(obj);

    tblProperty.innerHTML = "";

    for(let name of Object.getOwnPropertyNames(proto)){
        const desc = Object.getOwnPropertyDescriptor(proto, name);
        if(desc.get != undefined && desc.set != undefined){
            
            const tr = document.createElement("tr");

            const nameTd = document.createElement("td");
            nameTd.innerText = name;

            const valueTd = document.createElement("td");

            const value = desc.get.apply(obj);
            
            const inp = document.createElement("input");
            switch(typeof value){
            case "string":
            case "number":
                inp.type = "text";
                inp.value = `${value}`;
                inp.addEventListener("blur", (function(inp, desc){
                    return function(ev: FocusEvent){
                        desc.set.apply(obj, [ inp.value ]);
                    };
                })(inp, desc));

                break;
            case "boolean":
                inp.type = "checkbox";
                inp.checked = value as boolean;
                inp.addEventListener("click", (function(inp, desc){
                    return function(ev: MouseEvent){
                        desc.set.apply(obj, [ inp.checked ]);
                    };
                })(inp, desc));
                break;
            }
            valueTd.appendChild(inp);

            tr.appendChild(nameTd);
            tr.appendChild(valueTd);

            tblProperty.appendChild(tr);
        }
    }
}


function svgClick(ev: MouseEvent){
    if(view.capture != null || view.toolType == "TextSelection"){
        return;
    }

    if(view.toolType == "select"){

        for(let shape of view.shapes.values()){

            for(let name of Object.getOwnPropertyNames(shape)){
                const desc = Object.getOwnPropertyDescriptor(shape, name);

                if(desc.value == ev.srcElement){

                    showProperty(shape);
                    return
                }
            }        
        }

        showProperty(view);
        
        return;
    }

    const pt = getSvgPoint(ev, null);

    if(view.tool == null){
        view.tool = makeToolByType(view.toolType)!;
        console.assert(view.tool.getTypeName() == view.toolType.split('.')[0]);
        view.tool.init();
    }

    if(view.tool != null){

        view.tool.click(ev, pt);
    }
}

function svgPointermove(ev: PointerEvent){
    if(view.capture != null){
        return;
    }

    if(view.tool != null){
        view.tool.pointermove(ev);
    }
}

export function addShape(){
    const obj = {
        "_width" : "500px",
        "_height" : "500px",
        "_viewBox" : "-10 -10 20 20",
    };   

    const view1 = new View().make(obj);
    actions.push(view1);
    view1.init();
    divActions.appendChild(view1.summaryDom());
}

export function initDraw(){
    tblProperty = document.getElementById("tbl-property") as HTMLTableElement;

    TextBox.initDialog();

    const toolTypes = document.getElementsByName("tool-type");
    for(let x of toolTypes){
        x.addEventListener("click", setToolType);
    }

    Angle.initDialog();
}

export class Vec2 {
    x: number;
    y: number;

    constructor(x:number, y: number){
        this.x = x;
        this.y = y;
    }

    toJSON(key){
        const obj = { typeName: Vec2.name };
        Object.assign(obj, this);

        return JSON.stringify(obj);
    }

    equals(pt: Vec2): boolean {
        return this.x == pt.x && this.y == pt.y;
    }

    add(pt: Vec2) : Vec2{
        return new Vec2(this.x + pt.x, this.y + pt.y);
    }

    sub(pt: Vec2) : Vec2{
        return new Vec2(this.x - pt.x, this.y - pt.y);
    }

    mul(c: number) : Vec2 {
        return new Vec2(c * this.x, c * this.y);
    }

    len2(): number {
        return this.x * this.x + this.y * this.y;
    }

    len(): number {
        return Math.sqrt(this.len2());
    }

    dist(pt:Vec2) : number {
        const dx = pt.x - this.x;
        const dy = pt.y - this.y;

        return Math.sqrt(dx * dx + dy * dy);
    }

    dot(pt:Vec2) : number{
        return this.x * pt.x + this.y * pt.y;
    }

    unit() : Vec2{
        const d = this.len();

        if(d == 0){

            return new Vec2(0, 0);
        }

        return new Vec2(this.x / d, this.y / d);
    }
}

export class Mat2 {
    a11 : number;
    a12 : number;
    a21 : number;
    a22 : number;

    constructor(a11:number, a12:number, a21:number, a22:number){
        this.a11 = a11;
        this.a12 = a12;
        this.a21 = a21;
        this.a22 = a22;
    }

    print(){
        msg(`${this.a11} ${this.a12}\n${this.a21} ${this.a22}`);
    }

    det(){
        return this.a11 * this.a22 - this.a12 * this.a21;
    }

    mul(m:Mat2):Mat2 {
        return new Mat2(this.a11 * m.a11 + this.a12 * m.a21, this.a11 * m.a12 + this.a12 * m.a22, this.a21 * m.a11 + this.a22 * m.a21, this.a21 * m.a12 + this.a22 * m.a22);
    }

    dot(v:Vec2) : Vec2{
        return new Vec2(this.a11 * v.x + this.a12 * v.y, this.a21 * v.x + this.a22 * v.y);
    }

    inv() : Mat2 {
        const det = this.det();
        console.assert(det != 0);

        return new Mat2(this.a22 / det, - this.a12 / det, - this.a21 / det, this.a11 / det)
    }
}

export class ShapeEvent{
    destination: Shape;
    sources: Shape[];

    constructor(destination: Shape, sources: Shape[]){
        this.destination = destination;
        this.sources = sources;
    }
}

export class EventQueue {
    events : ShapeEvent[] = [];

    addEvent(destination:Shape, source: Shape){
        const event = this.events.find(x=>x.destination == destination);
        if(event == undefined){
            this.events.push( new ShapeEvent(destination, [source]) );
        }
        else{
            if(!event.sources.includes(source)){

                event.sources.push(source);
            }
        }
    }

    addEventMakeEventGraph(destination:Shape, source: Shape){
        this.addEvent(destination, source);
        destination.makeEventGraph(source);
    }

    processQueue =()=>{
        const processed : Shape[] = [];

        while(this.events.length != 0){
            let event = this.events[0];
            if(! processed.includes(event.destination)){
                processed.push(event.destination);

                event.destination.processEvent(event.sources);
            }
            this.events.shift();
        }
    }
}

export class View extends Action {
    div : HTMLDivElement;
    svg : SVGSVGElement;
    defs : SVGDefsElement;
    gridBg : SVGRectElement;
    G0 : SVGGElement;
    G1 : SVGGElement;
    G2 : SVGGElement;
    CTMInv : DOMMatrix;
    svgRatio: number;
    shapes: Map<number, Shape> = new Map<number, Shape>();
    toolType = "";
    selectedShapes: Shape[] = [];
    tool : Shape | null = null;
    eventQueue : EventQueue = new EventQueue();
    capture: Point|null = null;
    _showGrid : boolean = false;
    _gridWidth : number = 1;
    _gridHeight : number = 1;
    _snapToGrid: boolean = false;
    _flipY : boolean = false;

    _width      : string|undefined;
    _height     : string|undefined;
    _viewBox    : string|undefined;

    constructor(){
        super();
        view = this;     
    }
    
    make(data:any){
        const obj = data as View;

        if(obj.id != undefined){
            this.id = obj.id;
        }

        this.div = document.createElement("div");
        this.div.style.width = obj._width;
        this.div.style.height = obj._height;
        this.div.style.position = "relative";
        // this.div.style.borderStyle = "ridge";
        // this.div.style.borderWidth = "3px";
        this.div.style.padding = "0px";

        this.svg = document.createElementNS("http://www.w3.org/2000/svg","svg") as SVGSVGElement;

        this.svg.style.width = obj._width;
        this.svg.style.height = obj._height;
        this.svg.style.backgroundColor = "transparent";
        this.svg.style.margin = "0px";

        // viewBox="-10 -10 20 20"
        this.svg.setAttribute("viewBox", obj._viewBox);

        this.svg.setAttribute("preserveAspectRatio", "none");
        //---------- 
        divMath.appendChild(this.div);
        this.div.appendChild(this.svg);

        const CTM = this.svg.getCTM()!;
        if(CTM != null){

            this.CTMInv = CTM.inverse();
        }
    
        const rc = this.svg.getBoundingClientRect() as DOMRect;
        this.svgRatio = this.svg.viewBox.baseVal.width / rc.width;
    
        this.defs = document.createElementNS("http://www.w3.org/2000/svg","defs") as SVGDefsElement;
        this.svg.appendChild(this.defs);

        // グリッドの背景の矩形
        this.gridBg = document.createElementNS("http://www.w3.org/2000/svg","rect");
        this.svg.appendChild(this.gridBg);

        this.G0 = document.createElementNS("http://www.w3.org/2000/svg","g");
        this.G1 = document.createElementNS("http://www.w3.org/2000/svg","g");
        this.G2 = document.createElementNS("http://www.w3.org/2000/svg","g");
    
        if(this.flipY){
            
            this.G0.setAttribute("transform", "matrix(1, 0, 0, -1, 0, 0)");
            this.G1.setAttribute("transform", "matrix(1, 0, 0, -1, 0, 0)");
            this.G2.setAttribute("transform", "matrix(1, 0, 0, -1, 0, 0)");
        }
    
        this.svg.appendChild(this.G0);
        this.svg.appendChild(this.G1);
        this.svg.appendChild(this.G2);
    
        this.svg.addEventListener("click", svgClick);
        this.svg.addEventListener("pointermove", svgPointermove);  

        setToolType();

        return this;
    }

    makeObj(obj){
        Object.assign(obj, {
            "_width": this.svg.style.width,
            "_height": this.svg.style.height,
            "_viewBox": this.svg.getAttribute("viewBox")
        });
    }

    clear(){
        divMath.removeChild(this.div);
    }

    summary() : string {
        return "view";
    }

    get width() : string {
        return this.svg.style.width;
    }

    set width(value: string){
        this.div.style.width = value;
        this.svg.style.width = value;
    }

    get height() : string {
        return this.svg.style.height;
    }

    set height(value: string){
        this.div.style.height = value;
        this.svg.style.height = value;
    }

    get viewBox() : string {
        return this.svg.getAttribute("viewBox");
    }

    set viewBox(value: string){
        this.svg.setAttribute("viewBox", value);

        this.setGridBgBox();
    }

    get showGrid() : boolean {
        return this._showGrid;
    }

    set showGrid(value: boolean){
        if(this._showGrid == value){
            return;
        }

        this._showGrid = value;

        if(this._showGrid){
            this.setGridBgBox();
            this.setGridPattern();
        }
        else{

        this.gridBg.setAttribute("fill", "transparent");
        }
    }

    get gridWidth() {
        return this._gridWidth;
    }

    set gridWidth(value: any){
        this._gridWidth = parseFloat(value);

        this.setGridPattern();
    }

    get gridHeight() {
        return this._gridHeight;
    }

    set gridHeight(value: any){
        this._gridHeight = parseFloat(value);

        this.setGridPattern();
    }

    get snapToGrid(){
        return this._snapToGrid;
    }

    set snapToGrid(value: boolean){
        this._snapToGrid = value;
    }

    get flipY(){
        return this._flipY;
    }

    set flipY(value: boolean){
        this._flipY = value;
    }

    setGridBgBox(){
        // viewBoxを得る。
        const vb = this.svg.viewBox.baseVal;

        // グリッドの背景の矩形をviewBoxに合わせる。
        this.gridBg.setAttribute("x", `${vb.x}`);
        this.gridBg.setAttribute("y", `${vb.y}`);
        this.gridBg.setAttribute("width", `${vb.width}`);
        this.gridBg.setAttribute("height", `${vb.height}`);
    }

    setGridPattern(){
        // 現在のパターンを削除する。
        while(this.defs.childNodes.length != 0){
            this.defs.removeChild(this.defs.firstChild);
        }

        // viewBoxを得る。
        const vb = this.svg.viewBox.baseVal;

        const patternId = `pattern-${this.id}`;

        const pattern = document.createElementNS("http://www.w3.org/2000/svg","pattern") as SVGPatternElement;
        pattern.setAttribute("id", patternId);
        pattern.setAttribute("patternUnits", "userSpaceOnUse");
        pattern.setAttribute("x", `${vb.x}`);
        pattern.setAttribute("y", `${vb.y}`);
        pattern.setAttribute("width", `${this._gridWidth}`);
        pattern.setAttribute("height", `${this._gridHeight}`);
    
        this.defs.appendChild(pattern);

        const rect = document.createElementNS("http://www.w3.org/2000/svg","rect");
        rect.setAttribute("x", "0");
        rect.setAttribute("y", "0");
        rect.setAttribute("width", `${this._gridWidth}`);
        rect.setAttribute("height", `${this._gridHeight}`);
        rect.setAttribute("fill", "transparent");
        rect.setAttribute("stroke", "black");
        rect.setAttribute("stroke-width", `${this.toSvg2(gridLineWidth)}`);
    
        pattern.appendChild(rect);
    
        this.gridBg.setAttribute("fill", `url(#${patternId})`);
    }

    getDomPos(pt: Vec2) : Vec2 {
        const rc1 = this.svg.getBoundingClientRect() as DOMRect;
        const rc2 = this.div.getBoundingClientRect() as DOMRect;

        console.assert(rc1.x == rc2.x && rc1.y == rc2.y && rc1.width == rc2.width && rc1.height == rc2.height);

        const x = rc1.width  * (pt.x - this.svg.viewBox.baseVal.x) / this.svg.viewBox.baseVal.width;
        const y = rc1.height * (pt.y - this.svg.viewBox.baseVal.y) / this.svg.viewBox.baseVal.height;

        return new Vec2(x, y);
    }

    toSvg2(x:number) : number{
        return x * this.svgRatio;
    }    
}

export abstract class Shape extends Action {
    viewId: number;

    parentView : View;

    processEvent(sources: Shape[]){}
    listeners:Shape[] = [];

    select(selected: boolean){}

    click =(ev: MouseEvent, pt:Vec2): void => {}
    pointermove = (ev: PointerEvent) : void => {}

    constructor(){
        super();

        this.viewId = view.id;
        this.parentView = view;
        this.parentView.shapes.set(this.id, this);
    }

    makeObj(obj){
        obj.viewId = this.viewId;

        if(this.listeners.length != 0){

            Object.assign(obj, {
                listeners: this.listeners.map(x => ({ref:x.id}))
            });
        }
    }

    finishTool(){
        const v = Array.from(this.parentView.G0.childNodes.values());
        for(let x of v){
            if(!(x instanceof SVGImageElement)){

                this.parentView.G0.removeChild(x);
                this.parentView.G1.appendChild(x);
            }
        }
    
        for(let x of this.parentView.selectedShapes){
            x.select(false);
        }
        this.parentView.selectedShapes = [];
    
        actions.push(this.parentView.tool);
        divActions.appendChild(this.parentView.tool.summaryDom());
        this.parentView.tool = null;
    }

    bind(pt: Point){
        this.listeners.push(pt);
        pt.bindTo = this;
    }

    makeEventGraph(src:Shape|null){
        for(let shape of this.listeners){
            
            this.parentView.eventQueue.addEventMakeEventGraph(shape, this);
        }
    }

    toSvg(x:number) : number{
        return x * this.parentView.svgRatio;
    }    
}

export abstract class CompositeShape extends Shape {
    handles : Point[] = [];

    addHandle(handle: Point, useThisHandleMove: boolean = true){

        if(useThisHandleMove){

            handle.listeners.push(this);
        }
        this.handles.push(handle);
    }

    initChildren(children:Shape[]){
        for(let x of children){
            if(x != null){
                x.init();
            }
        }
    }
}

export class Point extends Shape {
    pos : Vec2;
    bindTo: Shape|undefined;

    circle : SVGCircleElement;

    constructor(){
        super();
    }
    
    make(data:any){
        const obj = data as Point;

        this.pos = obj.pos;
        //---------- 
        this.circle = document.createElementNS("http://www.w3.org/2000/svg","circle");
        this.circle.setAttribute("r", `${this.toSvg(5)}`);
        this.circle.setAttribute("fill", "blue");
        this.circle.addEventListener("pointerdown", this.pointerdown);
        this.circle.addEventListener("pointermove", this.pointermove);
        this.circle.addEventListener("pointerup", this.pointerup);

        this.circle.style.cursor = "pointer";

        this.setPos();
    
        this.parentView.G2.appendChild(this.circle);

        return this;
    }

    makeObj(obj){
        super.makeObj(obj);
        Object.assign(obj, { pos: this.pos });
        if(this.bindTo != undefined){
            obj.bindTo = { ref: this.bindTo.id };
        }
    }
    
    clear(){
    }

    summary() : string {
        return "点";
    }

    get x(){
        return this.pos.x;
    }

    set x(value:any){
        this.pos.x =  parseInt(value);
        this.setPos();
    }

    get y(){
        return this.pos.y;
    }

    set y(value:any){
        this.pos.y =  parseInt(value);
        this.setPos();
    }

    click =(ev: MouseEvent, pt:Vec2): void => {
        this.pos = pt;

        const line = getLine(ev);

        if(line == null){

            this.setPos();
        }
        else{

            line.bind(this)
            line.adjust(this);
        }

        this.finishTool();
    }

    setPos(){
        this.circle.setAttribute("cx", "" + this.pos.x);
        this.circle.setAttribute("cy", "" + this.pos.y);
    }

    select(selected: boolean){
        if(selected){
            if(! this.parentView.selectedShapes.includes(this)){
                this.parentView.selectedShapes.push(this);
                this.circle.setAttribute("fill", "orange");
            }
        }
        else{

            this.circle.setAttribute("fill", "blue");
        }
    }

    private dragPoint(ev: PointerEvent){
        this.pos = getSvgPoint(ev, this);
        if(this.bindTo != undefined){

            if(this.bindTo instanceof LineSegment){
                    (this.bindTo as LineSegment).adjust(this);
            }
            else if(this.bindTo instanceof Circle){
                (this.bindTo as Circle).adjust(this);
            }
            else{
                console.assert(false);
            }
        }
        else{

            this.setPos();
        }
    }

    processEvent =(sources: Shape[])=>{
        if(this.bindTo != undefined){

            if(this.bindTo instanceof LineSegment){
                    (this.bindTo as LineSegment).adjust(this);
            }
            else if(this.bindTo instanceof Circle){
                (this.bindTo as Circle).adjust(this);
            }
        }
    }

    pointerdown =(ev: PointerEvent)=>{
        if(this.parentView.toolType != "select"){
            return;
        }

        this.parentView.capture = this;
        this.circle.setPointerCapture(ev.pointerId);
    }

    pointermove =(ev: PointerEvent)=>{
        if(this.parentView.toolType != "select"){
            return;
        }

        if(this.parentView.capture != this){
            return;
        }

        this.dragPoint(ev);

        this.makeEventGraph(null);
        this.parentView.eventQueue.processQueue();
    }

    pointerup =(ev: PointerEvent)=>{
        if(this.parentView.toolType != "select"){
            return;
        }

        this.circle.releasePointerCapture(ev.pointerId);
        this.parentView.capture = null;

        this.dragPoint(ev);

        this.makeEventGraph(null);
        this.parentView.eventQueue.processQueue();
    }
}

export class LineSegment extends CompositeShape {    
    line : SVGLineElement;
    p1: Vec2 = new Vec2(0,0);
    p2: Vec2 = new Vec2(0,0);
    p12: Vec2 = new Vec2(0,0);
    e: Vec2 = new Vec2(0,0);
    len: number = 0;

    constructor(){
        super();
        //---------- 
        this.line = document.createElementNS("http://www.w3.org/2000/svg","line");
        this.line.setAttribute("stroke", "navy");
        this.line.setAttribute("stroke-width", `${this.toSvg(strokeWidth)}`);

        this.parentView.G0.appendChild(this.line);
    }

    *restore(){
        this.line.style.cursor = "move";
        this.updatePos();
    }

    get color(){
        return this.line.getAttribute("stroke");
    }

    set color(c:string){
        this.line.setAttribute("stroke", c);
    }
    
    select(selected: boolean){
        if(selected){
            if(! this.parentView.selectedShapes.includes(this)){
                this.parentView.selectedShapes.push(this);
                this.line.setAttribute("stroke", "orange");
            }
        }
        else{

            this.line.setAttribute("stroke", "navy");
        }
    }

    setPoints(p1:Vec2, p2:Vec2){
        this.line.setAttribute("x1", "" + p1.x);
        this.line.setAttribute("y1", "" + p1.y);

        this.line.setAttribute("x2", "" + p2.x);
        this.line.setAttribute("y2", "" + p2.y);

        if(this.handles.length != 0){
            this.handles[0].pos = p1;

            if(this.handles.length == 2){
                this.handles[1].pos = p2;
                this.handles[1]

                this.setVecs();
            }
        }
    }

    updatePos(){
        this.line.setAttribute("x1", "" + this.handles[0].pos.x);
        this.line.setAttribute("y1", "" + this.handles[0].pos.y);

        if(this.handles.length == 1){

            this.line.setAttribute("x2", "" + this.handles[0].pos.x);
            this.line.setAttribute("y2", "" + this.handles[0].pos.y);
        }
        else{

            this.line.setAttribute("x2", "" + this.handles[1].pos.x);
            this.line.setAttribute("y2", "" + this.handles[1].pos.y);

            this.setVecs();
        }
    }

    processEvent =(sources: Shape[])=>{
        for(let src of sources){
            if(src == this.handles[0]){

                const handle = this.handles[0];
                this.line.setAttribute("x1", "" + handle.pos.x);
                this.line.setAttribute("y1", "" + handle.pos.y);
            }
            else if(src == this.handles[1]){
                
                const handle = this.handles[1];
                this.line.setAttribute("x2", "" + handle.pos.x);
                this.line.setAttribute("y2", "" + handle.pos.y);
            }
            else{
                console.assert(src instanceof Rect || src instanceof ParallelLine);
            }
        }

        this.setVecs();
    }

    click =(ev: MouseEvent, pt:Vec2): void => {
        this.addHandle(clickHandle(ev, pt));

        this.line.setAttribute("x2", "" + pt.x);
        this.line.setAttribute("y2", "" + pt.y);
        if(this.handles.length == 1){

            this.line.setAttribute("x1", "" + pt.x);
            this.line.setAttribute("y1", "" + pt.y);
        }
        else{
            this.line.style.cursor = "move";
            this.setVecs();

            this.finishTool();
        }    

    }

    pointermove =(ev: PointerEvent) : void =>{
        const pt = getSvgPoint(ev, null);

        this.line!.setAttribute("x2", "" + pt.x);
        this.line!.setAttribute("y2", "" + pt.y);
    }

    setVecs(){
        this.p1 = this.handles[0].pos;
        this.p2 = this.handles[1].pos;
        this.p12 = this.p2.sub(this.p1);
        this.e = this.p12.unit();
        this.len = this.p12.len();
    }

    adjust(handle: Point) {
        let posInLine;

        if(this.len == 0){
            posInLine = 0;
        }
        else{
            posInLine = this.e.dot(handle.pos.sub(this.p1)) / this.len;
        }
        handle.pos = this.p1.add(this.p12.mul(posInLine));
        handle.setPos();
    }
}

export class Rect extends CompositeShape {
    isSquare: boolean;
    lines : Array<LineSegment> = [];
    h : number = -1;
    inSetRectPos : boolean = false;

    constructor(){
        super();
    }

    make(data:any):Action{
        const obj = data as Rect;

        this.isSquare = obj.isSquare;

        return this;
    }

    init(){
        super.init();

        this.handles.slice(0, 3).forEach(x => x.listeners.push(this));

        this.lines.forEach(x => x.init());
    }

    *restore(){
        for(let line of this.lines){

            yield* line.restore();
        }
    }

    makeObj(obj){
        super.makeObj(obj);
        Object.assign(obj, {
            isSquare: this.isSquare,
            lines: this.lines.map(x => x.toObj())
        });
    }

    setRectPos(pt: Vec2|null, idx: number, clicked:boolean){
        if(this.inSetRectPos){
            return;
        }
        this.inSetRectPos = true;

        const p1 = this.handles[0].pos; 

        let p2;

        if(this.handles.length == 1){

            p2 = pt!;
        }
        else{

            p2 = this.handles[1].pos; 
        }

        const p12 = p2.sub(p1);

        const e = (new Vec2(- p12.y, p12.x)).unit();

        let h;
        if(this.isSquare){

            h = p12.len();
        }
        else{

            if(this.h == -1 || idx == 2){

                let pa;
                if(this.handles.length < 4){
        
                    pa = pt!;
        
                }
                else{
        
                    pa = this.handles[2].pos; 
                }
        
                const p0a = pa.sub(p1);
                h = e.dot(p0a);
    
                if(this.handles.length == 4){
                    this.h = h;
                }
            }
            else{
                h = this.h;
            }
        }

        const eh = e.mul(h);
        const p3 = p2.add(eh);
        const p4 = p3.add(p1.sub(p2));

        const line1 = this.lines[0];
        line1.setPoints(p1, p2);

        const line2 = this.lines[1];
        line2.setPoints(p2, p3);

        const line3 = this.lines[2];
        line3.setPoints(p3, p4);

        const line4 = this.lines[3];
        line4.setPoints(p4, p1);

        if(clicked){
            if(this.handles.length == 2 && this.isSquare){

                line1.addHandle(this.handles[1], false);
                line2.addHandle(this.handles[1], false);

                line1.line.style.cursor = "move";
                
                const handle3 = initPoint(p3);
                this.handles.push(handle3);
            }

            switch(this.handles.length){
            case 1:
                line1.addHandle(this.handles[0], false);
                break;
            case 2:
                line1.addHandle(this.handles[1], false);
                line2.addHandle(this.handles[1], false);

                line1.line.style.cursor = "move";

                break;
            case 3:
                line2.addHandle(this.handles[2], false);
                line2.line.style.cursor = "move";

                const handle4 = initPoint(p4);
                this.handles.push(handle4);

                line3.addHandle(this.handles[2], false);
                line3.addHandle(handle4, false);
                line3.line.style.cursor = "move";

                line4.addHandle(handle4, false);
                line4.addHandle(this.handles[0], false);
                line4.line.style.cursor = "move";
                break;
            }
        }

        if(3 <= this.handles.length){

            this.handles[2].pos = p3;
            this.handles[2].setPos();
    
            if(this.handles.length == 4){

                this.handles[3].pos = p4;
                this.handles[3].setPos();        
            }
        }

        this.inSetRectPos = false;
    }

    makeEventGraph(src:Shape|null){
        super.makeEventGraph(src);

        if(src == this.handles[0] || src == this.handles[1]){

            this.parentView.eventQueue.addEventMakeEventGraph(this.handles[2], this);
        }
        else{
            console.assert(src == this.handles[2]);
        }

        for(let line of this.lines){

            this.parentView.eventQueue.addEventMakeEventGraph(line, this);
        }
    }

    processEvent =(sources: Shape[])=>{
        for(let source of sources){
            console.assert(source.constructor.name == "Point");
            let i = this.handles.indexOf(source as Point);
            console.assert([0, 1, 2].includes(i));
        }

        const handle = sources[0] as Point;

        const idx = this.handles.indexOf(handle);
        this.setRectPos(handle.pos, idx, false);
    }

    click =(ev: MouseEvent, pt:Vec2): void =>{
        if(this.lines.length == 0){

            for(let i = 0; i < 4; i++){

                const line = initLineSegment();
                this.lines.push(line);
            }
        }

        this.addHandle(clickHandle(ev, pt));

        this.setRectPos(pt, -1, true);

        if(this.handles.length == 4){

            for(let line of this.lines){
                console.assert(line.handles.length == 2);
                line.setVecs();
            }
            this.finishTool();
        }    
    }

    pointermove =(ev: PointerEvent) : void =>{
        const pt = getSvgPoint(ev, null);

        this.setRectPos(pt, -1, false);
    }
}

export class Circle extends CompositeShape {
    byDiameter:boolean 
    center: Vec2|null = null;
    radius: number = this.toSvg(1);
    
    circle: SVGCircleElement;

    constructor(){
        super();
    }

    make(data:any):Action{
        const obj = data as Circle;

        this.byDiameter = obj.byDiameter;
        //---------- 
        this.circle = document.createElementNS("http://www.w3.org/2000/svg","circle");
        this.circle.setAttribute("fill", "none");// "transparent");
        this.circle.setAttribute("stroke", "navy");
        this.circle.setAttribute("stroke-width", `${this.toSvg(strokeWidth)}`);     
        this.circle.setAttribute("fill-opacity", "0");
        
        this.parentView.G0.appendChild(this.circle);    

        return this;
    }

    init(){
        super.init();
    }

    *restore(){
        for(let p of this.handles){
            p.listeners.push(this);
        }

        this.processEvent(this.handles);
    }

    makeObj(obj){
        super.makeObj(obj);
        Object.assign(obj, { byDiameter: this.byDiameter });
    }

    get color(){
        return this.circle.getAttribute("stroke");
    }

    set color(c:string){
        this.circle.setAttribute("stroke", c);
    }

    setCenter(pt: Vec2){
        this.center = this.handles[0].pos.add(pt).mul(0.5);

        this.circle.setAttribute("cx", "" + this.center.x);
        this.circle.setAttribute("cy", "" + this.center.y);
    }

    setRadius(pt: Vec2){
        this.radius = this.center!.dist(pt);
        this.circle!.setAttribute("r", "" +  this.radius );
    }

    processEvent =(sources: Shape[])=>{
        for(let src of sources){
            if(src == this.handles[0]){

                if(this.byDiameter){

                    this.setCenter(this.handles[1].pos);
                }
                else{
        
                    this.center = this.handles[0].pos;
                    this.circle.setAttribute("cx", "" + this.handles[0].pos.x);
                    this.circle.setAttribute("cy", "" + this.handles[0].pos.y);
                }
        
                this.setRadius(this.handles[1].pos);
            }
            else if(src == this.handles[1]){

                if(this.byDiameter){
                    this.setCenter(this.handles[1].pos);
                }

                this.setRadius(this.handles[1].pos);
            }
            else{
                console.assert(false);
            }
        }
    }

    click =(ev: MouseEvent, pt:Vec2): void =>{
        this.addHandle(clickHandle(ev, pt));

        if(this.handles.length == 1){

            this.center = pt;

            this.circle.setAttribute("cx", "" + pt.x);
            this.circle.setAttribute("cy", "" + pt.y);
            this.circle.setAttribute("r", "" + this.radius);
        }
        else{
            if(this.byDiameter){

                this.setCenter(pt);
            }
    
            this.setRadius(pt);
            this.circle.style.cursor = "move";
    
            this.finishTool();
        }
    }

    pointermove =(ev: PointerEvent) : void =>{
        const pt = getSvgPoint(ev, null);

        if(this.byDiameter){

            this.setCenter(pt);
        }
        this.setRadius(pt);
    }

    adjust(handle: Point) {
        const v = handle.pos.sub(this.center!);
        const theta = Math.atan2(v.y, v.x);

        handle.pos = new Vec2(this.center!.x + this.radius * Math.cos(theta), this.center!.y + this.radius * Math.sin(theta));

        handle.setPos();
    }
}


export class DimensionLine extends CompositeShape {
    arcs: SVGPathElement[];
    lines : SVGLineElement[];

    constructor(){
        super();

        this.arcs = [];
        this.lines = [];

        for(let i = 0; i < 2; i++){

            const arc = document.createElementNS("http://www.w3.org/2000/svg","path");

            arc.setAttribute("fill", "none");
            arc.setAttribute("stroke", "red");
            arc.setAttribute("stroke-width", `${this.toSvg(thisStrokeWidth)}`);
            arc.style.cursor = "pointer";
            arc.style.zIndex = "-2";

            this.parentView.G0.appendChild(arc);

            this.arcs.push(arc);

            const line = document.createElementNS("http://www.w3.org/2000/svg","line");
            line.setAttribute("stroke", "red");
            line.setAttribute("stroke-width", `${this.toSvg(thisStrokeWidth)}`);
    
            this.parentView.G0.appendChild(line);
    
            this.lines.push(line);
        }
    }

    *restore(){
    }

    processEvent =(sources: Shape[])=>{
        this.drawPath(this.handles[2].pos);
    }

    click =(ev: MouseEvent, pt:Vec2): void =>{
        this.addHandle(clickHandle(ev, pt));

        if(this.handles.length == 3){
    
            this.finishTool();
        }
    }

    pointermove =(ev: PointerEvent) : void =>{
        if(this.handles.length != 2){
            return;
        }

        this.drawPath(getSvgPoint(ev, null));
    }

    drawPath(p3: Vec2){
        const p1 = this.handles[0].pos;
        const p2 = this.handles[1].pos;

        const p21 = p1.sub(p2);
        const p23 = p3.sub(p2);
        const l1 = p21.unit().dot(p23);
        const p4 = p2.add(p21.unit().mul(l1));

        const v = p3.sub(p4);
        const r = v.len();
        const r2 = Math.min(r, p21.len() / 2);

        const p1c = p1.add(v);
        const p1d = p1c.add(p21.unit().mul(-r2));
        const d1 = `M${p1.x} ${p1.y} Q ${p1c.x} ${p1c.y} ${p1d.x} ${p1d.y}`;

        this.arcs[0].setAttribute("d", d1);

        const p2c = p2.add(v);
        const p2d = p2c.add(p21.unit().mul(r2));
        const d2 = `M${p2.x} ${p2.y} Q ${p2c.x} ${p2c.y} ${p2d.x} ${p2d.y}`;

        this.arcs[1].setAttribute("d", d2);


        const line_len = Math.min(l1, p21.len() / 2) - r;
        if(0 < line_len){

            this.lines[0].setAttribute("x1", "" + p1d.x);
            this.lines[0].setAttribute("y1", "" + p1d.y);

            const p5 = p1d.add(p21.unit().mul(- line_len))
            this.lines[0].setAttribute("x2", "" + p5.x);
            this.lines[0].setAttribute("y2", "" + p5.y);


            this.lines[1].setAttribute("x1", "" + p2d.x);
            this.lines[1].setAttribute("y1", "" + p2d.y);

            const p6 = p2d.add(p21.unit().mul(line_len))
            this.lines[1].setAttribute("x2", "" + p6.x);
            this.lines[1].setAttribute("y2", "" + p6.y);

            this.lines.forEach(x => x.style.visibility = "visible");
        }
        else{
            this.lines.forEach(x => x.style.visibility = "hidden");
        }

    }
}

export class Triangle extends CompositeShape {
    lines : Array<LineSegment> = [];

    makeObj(obj){
        super.makeObj(obj);
        Object.assign(obj, { lines: this.lines.map(x => x.toObj()) });
    }

    init(){
        this.lines.forEach(x => x.init());
    }

    *restore(){
        for(let line of this.lines){

            yield* line.restore();
        }
    }

    click =(ev: MouseEvent, pt:Vec2): void =>{
        const line = initLineSegment();

        if(this.lines.length == 0){
            line.addHandle(clickHandle(ev, pt));
        }
        else{

            const lastLine = arrayLast(this.lines);
            const handle = clickHandle(ev, pt);
            lastLine.addHandle(handle);
            lastLine.updatePos();
            lastLine.line.style.cursor = "move";

            line.addHandle(handle);
        }

        if(this.lines.length == 2){

            const handle1 = this.lines[0].handles[0];

            line.addHandle(handle1);
            line.line.style.cursor = "move";

            this.finishTool();
        }

        this.lines.push(line);
        line.updatePos();
    }

    pointermove =(ev: PointerEvent) : void =>{
        const lastLine = arrayLast(this.lines);
        lastLine.pointermove(ev);
    }
}

export class TextBox extends Shape {
    static dialog : HTMLDialogElement;
    static textBox : TextBox;
    
    domPos: Vec2;
    text: string;

    div : HTMLDivElement | null = null;

    offsetPos: Vec2;
    pagePos: Vec2;

    static okClick(){
        const self = TextBox.textBox;

        const text = (document.getElementById("text-box-text") as HTMLTextAreaElement).value;
        self.make({text: text});
        TextBox.dialog.close();
    }

    static initDialog(){
        TextBox.dialog = document.getElementById('text-box-dlg') as HTMLDialogElement;
        (document.getElementById("text-box-ok") as HTMLInputElement).addEventListener("click", TextBox.okClick);
    }

    constructor(){
        super();
        TextBox.textBox = this;

        this.div = document.createElement("div");
        this.div.style.position = "absolute";
        this.div.style.backgroundColor = "cornsilk";
        this.div.style.cursor = "move";
        this.div.style.zIndex = "-1";

        this.parentView.div.appendChild(this.div);

        this.div.addEventListener("pointerdown", (ev: PointerEvent)=>{
            if(view.toolType == "select"){
                this.div.setPointerCapture(ev.pointerId);

                this.div.addEventListener("pointermove", this.pointermove);

                this.offsetPos = new Vec2(this.div.offsetLeft, this.div.offsetTop);
                this.pagePos = new Vec2(ev.pageX, ev.pageY);
            }
        });

        this.div.addEventListener("pointerup", (ev: PointerEvent)=>{
            switch(view.toolType){
            case "select":

                this.div.removeEventListener("pointermove", this.pointermove);
                this.div.releasePointerCapture(ev.pointerId);
                break;

            case "TextSelection":

                onclickBlock(this.div, ev);
                break;
            }
        });
    }

    make(data:any){
        const obj = data as TextBox;

        this.div.id = getBlockId(this.id);

        console.assert(obj.text != undefined);

        if(obj.domPos != undefined){

            this.domPos = obj.domPos;
            this.updatePos();
        }

        this.text   = obj.text;

        this.div.innerHTML = makeHtmlLines(this.text);

        MathJax.Hub.Queue(["Typeset",MathJax.Hub]);    

        return this;
    }

    pointermove=(ev: PointerEvent)=>{
        const x = this.offsetPos.x + (ev.pageX - this.pagePos.x);
        const y = this.offsetPos.y + (ev.pageY - this.pagePos.y);

        this.domPos = new Vec2(x, y);

        this.updatePos();
    }

    makeObj(obj){
        super.makeObj(obj);
        Object.assign(obj, {
            domPos: this.domPos,
            text: this.text
        });
    }

    click =(ev: MouseEvent, pt:Vec2) : void =>{
        this.domPos = new Vec2(ev.offsetX, ev.offsetY);

        this.updatePos();

        TextBox.dialog.showModal();
        this.finishTool();
    }

    updatePos(){
        this.div.style.left  = `${this.domPos.x}px`;
        this.div.style.top   = `${this.domPos.y}px`;
    }
}

export class Midpoint extends CompositeShape {
    midpoint : Point | null = null;

    init(){
        super.init();
        this.initChildren([this.midpoint]);
    }

    makeObj(obj){
        super.makeObj(obj);
        Object.assign(obj, { midpoint: this.midpoint.toObj() });
    }

    calcMidpoint(){
        const p1 = this.handles[0].pos;
        const p2 = this.handles[1].pos;

        return new Vec2((p1.x + p2.x)/2, (p1.y + p2.y)/2);
    }

    makeEventGraph(src:Shape|null){
        super.makeEventGraph(src);

        this.parentView.eventQueue.addEventMakeEventGraph(this.midpoint!, this);
    }

    processEvent =(sources: Shape[])=>{
        this.midpoint!.pos = this.calcMidpoint();
        this.midpoint!.setPos();
    }

    click =(ev: MouseEvent, pt:Vec2): void => {
        this.addHandle(clickHandle(ev, pt));

        if(this.handles.length == 2){

            this.midpoint = initPoint( this.calcMidpoint() );

            this.finishTool();
        }
    }
}


export class Perpendicular extends CompositeShape {
    line : LineSegment | null = null;
    foot : Point | null = null;
    perpendicular : LineSegment | null = null;
    inHandleMove: boolean = false;

    init(){
        super.init();
        this.initChildren([this.line, this.foot, this.perpendicular]);
    }

    *restore(){
        yield* this.perpendicular.restore();
    }
    
    makeObj(obj){
        super.makeObj(obj);
        Object.assign(obj, {
            line: this.line.toObj(),
            foot: this.foot.toObj(),
            perpendicular: this.perpendicular.toObj()
        });
    }

    makeEventGraph(src:Shape|null){
        super.makeEventGraph(src);

        this.parentView.eventQueue.addEventMakeEventGraph(this.foot!, this);
    }

    processEvent =(sources: Shape[])=>{
        if(this.inHandleMove){
            return;
        }
        this.inHandleMove = true;

        this.foot!.pos = calcFootOfPerpendicular(this.handles[0].pos, this.line!);
        this.foot!.setPos();

        this.perpendicular!.setPoints(this.handles[0].pos, this.foot!.pos);

        this.inHandleMove = false;
    }

    click =(ev: MouseEvent, pt:Vec2): void => {
        if(this.handles.length == 0){

            this.addHandle(clickHandle(ev, pt));
        }
        else {

            this.line = getLine(ev);
            if(this.line == null){
                return;
            }

            this.line.listeners.push(this);

            this.foot = initPoint( calcFootOfPerpendicular(this.handles[0].pos, this.line!) );

            this.perpendicular = initLineSegment();
            this.perpendicular.line.style.cursor = "move";
            this.perpendicular.addHandle(this.handles[0]);
            this.perpendicular.addHandle(this.foot, false);

            this.perpendicular.setVecs();
            this.perpendicular.updatePos();

            this.finishTool();
        }
    }
}

export class ParallelLine extends CompositeShape {
    line1 : LineSegment | null = null;
    line2 : LineSegment | null = null;
    point : Point|null = null;

    init(){
        if(this.line2 != null){

            this.line2.init();
        }
    }

    *restore(){
        yield* this.line2.restore();
    }
    
    makeObj(obj){
        super.makeObj(obj);
        Object.assign(obj, {
            line1: this.line1.toObj(),
            line2: this.line2.toObj(),
            point: this.point.toObj()
        });
    }

    calcParallelLine(){
        const p1 = this.point!.pos.add(this.line1!.e.mul(infinity));
        const p2 = this.point!.pos.sub(this.line1!.e.mul(infinity));

        this.line2!.setPoints(p1, p2);
    }

    makeEventGraph(src:Shape|null){
        super.makeEventGraph(src);

        this.parentView.eventQueue.addEventMakeEventGraph(this.line2!, this);
    }

    processEvent =(sources: Shape[])=>{
        this.calcParallelLine();
    }

    click =(ev: MouseEvent, pt:Vec2): void => {
        if(this.line1 == null){

            this.line1 = getLine(ev);
            if(this.line1 == null){
                return;
            }

            this.line1.select(true);
            this.line1.listeners.push(this);
        }
        else {

            this.point = getPoint(ev);
            if(this.point == null){
                return;
            }

            this.point.listeners.push(this);

            this.line2 = initLineSegment();
            this.line2.line.style.cursor = "move";

            this.line2.addHandle(initPoint(new Vec2(0,0)));
            this.line2.addHandle(initPoint(new Vec2(0,0)));
            this.calcParallelLine();
            for(let handle of this.line2.handles){
                handle.setPos();
            }

            this.finishTool();
        }
    }
}

export class Intersection extends CompositeShape {
    lines : LineSegment[] = [];
    intersection : Point|null = null;

    
    makeObj(obj){
        super.makeObj(obj);
        Object.assign(obj, {
            lines: this.lines.map(x => x.toObj()),
            intersection: this.intersection.toObj()
        });
    }

    makeEventGraph(src:Shape|null){
        super.makeEventGraph(src);

        this.parentView.eventQueue.addEventMakeEventGraph(this.intersection!, this);
    }

    processEvent =(sources: Shape[])=>{
        this.intersection!.pos = linesIntersection(this.lines[0], this.lines[1]);
        this.intersection!.setPos();
    }

    click =(ev: MouseEvent, pt:Vec2): void => {
        const line = getLine(ev);
        
        if(line != null){
            this.lines.push(line);

            if(this.lines.length == 1){


                line.select(true);
            }
            else{

                const v = linesIntersection(this.lines[0], this.lines[1]);
                this.intersection = initPoint(v);

                for(let line2 of this.lines){

                    line2.listeners.push(this);
                }

                this.finishTool();
            }
        }
    }

    pointermove = (ev: PointerEvent) : void => {
    }
}

export class Angle extends CompositeShape {
    lines : LineSegment[] = [];
    ts : number[] = [];

    arc: SVGPathElement|null = null;

    static current: Angle;

    constructor(){
        super();
        this.arc = document.createElementNS("http://www.w3.org/2000/svg","path");

        this.arc.setAttribute("fill", "none");
        this.arc.setAttribute("stroke", "red");
        this.arc.setAttribute("stroke-width", `${this.toSvg(thisStrokeWidth)}`);
        this.arc.addEventListener("click", this.arcClick);
        this.arc.style.cursor = "pointer";

        this.parentView.G0.appendChild(this.arc);
    }

    *restore(){
        this.drawArc();
    }
    
    makeObj(obj){
        super.makeObj(obj);
        Object.assign(obj, {
            lines: this.lines.map(x => x.toObj()),
            ts: Array.from(this.ts)
        });
    }

    get color(){
        return this.arc.getAttribute("stroke");
    }

    set color(c:string){
        this.arc.setAttribute("stroke", c);
    }

    drawArc(){
        const line1 = this.lines[0];
        const line2 = this.lines[1];

        const q1 = line1.p1.add(line1.p12.mul(this.ts[0]));
        const q2 = line2.p1.add(line2.p12.mul(this.ts[1]));

        const p = linesIntersection(this.lines[0], this.lines[1]);

        const sign1 = Math.sign(q1.sub(p).dot(line1.e));
        const sign2 = Math.sign(q2.sub(p).dot(line2.e));

        const r = this.toSvg(40);        
        const p1 = p.add(this.lines[0].e.mul(r * sign1));
        const p2 = p.add(this.lines[1].e.mul(r * sign2));

        let theta1 = Math.atan2(q1.y - p.y, q1.x - p.x);
        let theta2 = Math.atan2(q2.y - p.y, q2.x - p.x);

        if(theta1 < 0){
            theta1 += 2 * Math.PI;
        }
        if(theta2 < 0){
            theta2 += 2 * Math.PI;
        }
        
        let deltaTheta = theta2 - theta1;
        if(deltaTheta < 0){
            deltaTheta += 2 * Math.PI;
        }

        const largeArcSweepFlag = (Math.PI < deltaTheta ? 1 : 0);

        const d = `M${p1.x} ${p1.y} A ${r} ${r} 0 ${largeArcSweepFlag} 1 ${p2.x} ${p2.y}`;

        this.arc!.setAttribute("d", d);
    }

    processEvent =(sources: Shape[])=>{
        this.drawArc();
    }

    okClick(){
        this.arc!.setAttribute("stroke", angleDlgColor.value.trim());

        angleDlg.close();
    }


    static initDialog(){
        angleDlg = document.getElementById('angle-dlg') as HTMLDialogElement;
        angleDlgOk = document.getElementById('angle-dlg-ok') as HTMLInputElement;
        angleDlgColor = document.getElementById('angle-dlg-color') as HTMLInputElement;

        angleDlg.addEventListener("keydown", ev=>{
            if(ev.key == 'Enter'){
                Angle.current.okClick();
            }    
        });

        angleDlgOk.addEventListener("click", ev=>{
            Angle.current.okClick();    
        });
    
    }

    arcClick = (ev: MouseEvent)=>{
        Angle.current = this;
        angleDlgColor.value = this.arc!.getAttribute("stroke")!;

        angleDlg.showModal();
    }

    click =(ev: MouseEvent, pt:Vec2): void => {
        const line = getLine(ev);
        
        if(line != null){
            this.lines.push(line);

            const t = pt.sub(line.p1).dot(line.e) / line.len;
            this.ts.push(t);

            if(this.lines.length == 1){


                line.select(true);
            }
            else{

                this.drawArc();
        
                for(let line2 of this.lines){

                    line2.listeners.push(this);
                }

                this.finishTool();
            }
        }
    }

    pointermove = (ev: PointerEvent) : void => {
    }
}


export class Label extends CompositeShape {
    text: string;

    svgText: SVGTextElement;

    constructor(){
        super();
    }

    make(data:any):Action{
        const obj = data as Label;

        this.text = obj.text;

        this.svgText = document.createElementNS("http://www.w3.org/2000/svg","text");
        if(this.parentView.flipY){
            
            this.svgText.setAttribute("transform", "matrix(1, 0, 0, -1, 0, 0)");
        }
        this.svgText.setAttribute("stroke", "navy");

        const p = toSvgRatio();
        this.svgText.setAttribute("font-size", `${16 * p.y}`);
        this.svgText.setAttribute("stroke-width", `${0.2 * p.y}`);

        this.svgText.textContent = obj.text;

        this.parentView.G0.appendChild(this.svgText);

        return this;
    }

    *restore(){
        this.processEvent([this.handles[0]]);
    }

    makeObj(obj){
        super.makeObj(obj);
        Object.assign(obj, {
            text: this.text
        });
    }

    processEvent =(sources: Shape[])=>{
        console.assert(sources.length == 1 && sources[0] == this.handles[0]);
        this.svgText.setAttribute("x", "" + this.handles[0].pos.x);
        this.svgText.setAttribute("y", "" + this.handles[0].pos.y);
    }

    click =(ev: MouseEvent, pt:Vec2): void => {
        this.addHandle(clickHandle(ev, pt));

        this.svgText.setAttribute("x", "" + this.handles[0].pos.x);
        this.svgText.setAttribute("y", "" + this.handles[0].pos.y);
        this.finishTool();
    }
}


export class Image extends CompositeShape {
    pos: Vec2;
    fileName: string;

    image: SVGImageElement;

    pointerPos: Vec2;

    constructor(){
        super();
    }

    make(data:any):Action{
        const obj = data as Image;

        this.fileName = obj.fileName;

        this.image = document.createElementNS("http://www.w3.org/2000/svg", "image") as SVGImageElement;
        if(this.parentView.flipY){
            
            this.image.setAttribute("transform", "matrix(1, 0, 0, -1, 0, 0)");
        }
        this.image.setAttribute("preserveAspectRatio", "none");
        setSvgImg(this.image, obj.fileName);

        this.parentView.G0.appendChild(this.image);
    
        this.image.addEventListener("load", (ev:Event) => {
            if(this.handles.length != 0){

                this.image.setAttribute("x", `${this.pos.x}`);
                this.image.setAttribute("y", `${this.pos.y}`);

                const x1 = this.handles[0].pos.x;
                const y1 = this.handles[0].pos.y;

                const w = x1 - this.pos.x;
                const h = y1 - this.pos.y;
                this.image.setAttribute("width", `${w}`);
                this.image.setAttribute("height", `${h}`);
                    
                return;
            }
            const rc = this.image.getBoundingClientRect();
            msg(`img loaded w:${rc.width} h:${rc.height}`);
    
            // 縦横比 = 縦 / 横
            const ratio = rc.height / rc.width;
    
            // viewBoxを得る。
            const vb = this.parentView.svg.viewBox.baseVal;
    
            // 縦横比を保って幅がsvgの半分になるようにする。
            const w = vb.width / 2;
            const h = ratio * vb.width / 2;
            this.image.setAttribute("width", `${w}`);
            this.image.setAttribute("height", `${h}`);
    
            // svgの中央に配置する。
            this.pos = new Vec2( vb.x + (vb.width - w) / 2, vb.y + (vb.height - h) / 2);

            this.image.setAttribute("x", `${this.pos.x}`);
            this.image.setAttribute("y", `${this.pos.y}`);
    
            this.addHandle(initPoint(new Vec2(this.pos.x + w, this.pos.y + h)));
        });


        this.image.addEventListener("pointerdown", (ev: PointerEvent)=>{
            this.image.setPointerCapture(ev.pointerId);

            this.image.addEventListener("pointermove", this.pointermove);

            this.pointerPos = getSvgPoint(ev, null);
        });

        this.image.addEventListener("pointerup", (ev: PointerEvent)=>{
            this.pos = new Vec2(parseFloat(this.image.getAttribute("x")), parseFloat(this.image.getAttribute("y")));
            this.image.removeEventListener("pointermove", this.pointermove);
            this.image.releasePointerCapture(ev.pointerId);
        });
        
        return this;
    }

    makeObj(obj){
        super.makeObj(obj);
        Object.assign(obj, {
            pos: this.pos,
            fileName: this.fileName
        });
    }

    pointermove=(ev: PointerEvent)=>{
        const pt = getSvgPoint(ev, null);
        const x = this.pos.x + (pt.x - this.pointerPos.x);
        const y = this.pos.y + (pt.y - this.pointerPos.y);

        this.image.setAttribute("x", `${x}`);
        this.image.setAttribute("y", `${y}`);

        this.handles[0].pos.x = x + this.image.width.baseVal.value;
        this.handles[0].pos.y = y + this.image.height.baseVal.value;

        this.handles[0].setPos();
    }

    processEvent =(sources: Shape[])=>{
        for(let src of sources){
            if(src == this.handles[0]){
                const x = parseFloat(this.image.getAttribute("x"));
                const y = parseFloat(this.image.getAttribute("y"));

                const w = this.handles[0].pos.x - x;
                const h = this.handles[0].pos.y - y;
                
                this.image.setAttribute("width", `${w}`);
                this.image.setAttribute("height", `${h}`);
            }
            else{
                console.assert(false);
            }
        }
    }
}

}