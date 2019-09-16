/// <reference path="util.ts" />
/// <reference path="main.ts" />
namespace manebu{

const infinity = 20;
const stroke_width = 4;
const this_stroke_width = 2;
const grid_line_width = 1;

declare var MathJax:any;

function initPoint(pt:Vec2){
    var point = new Point(pt);
    point.init();

    return point;
}

function initLineSegment(){
    var line = new LineSegment();
    line.init();

    return line;
}

export class View extends Action {
    div : HTMLDivElement;
    svg : SVGSVGElement;
    defs : SVGDefsElement;
    gridBg : SVGRectElement;
    G0 : SVGGElement;
    G1 : SVGGElement;
    G2 : SVGGElement;
    CTM : DOMMatrix;
    CTMInv : DOMMatrix;
    svg_ratio: number;
    shapes: Map<number, Shape> = new Map<number, Shape>();
    tool_type = "";
    selected_shapes: Shape[] = [];
    tool : Shape | null = null;
    event_queue : EventQueue = new EventQueue();
    capture: Point|null = null;
    _showGrid : boolean = false;
    _gridWidth : number = 1;
    _gridHeight : number = 1;
    _snapToGrid: boolean = false;
    _flipY : boolean = false;

    constructor(obj: any){
        super();

        if(obj.id != undefined){
            this.id = obj.id;
        }

        view = this;     

        this.div = document.createElement("div");
        this.div.style.width = obj._width;
        this.div.style.height = obj._height;
        this.div.style.position = "relative";
        this.div.style.borderStyle = "ridge";
        this.div.style.borderWidth = "3px";

        this.svg = document.createElementNS("http://www.w3.org/2000/svg","svg") as SVGSVGElement;

        this.svg.style.width = obj._width;
        this.svg.style.height = obj._height;
        this.svg.style.backgroundColor = "wheat";
    
        // viewBox="-10 -10 20 20"
        this.svg.setAttribute("viewBox", obj._viewBox);

        this.svg.setAttribute("preserveAspectRatio", "none");
        //---------- 
        divMath.appendChild(this.div);
        this.div.appendChild(this.svg);

        this.CTM = this.svg.getCTM()!;
        this.CTMInv = this.CTM.inverse();
    
        var rc = this.svg.getBoundingClientRect() as DOMRect;
        this.svg_ratio = this.svg.viewBox.baseVal.width / rc.width;
    
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
    
        this.svg.addEventListener("click", svg_click);
        this.svg.addEventListener("pointermove", svg_pointermove);  

        setToolType();
    }

    makeObj(obj){
        Object.assign(obj, {
            "_width": this.svg.style.width,
            "_height": this.svg.style.height,
            "_viewBox": this.svg.getAttribute("viewBox")
        });
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
        var vb = this.svg.viewBox.baseVal;

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
        var vb = this.svg.viewBox.baseVal;

        var pattern_id = `pattern-${this.id}`;

        var pattern = document.createElementNS("http://www.w3.org/2000/svg","pattern") as SVGPatternElement;
        pattern.setAttribute("id", pattern_id);
        pattern.setAttribute("patternUnits", "userSpaceOnUse");
        pattern.setAttribute("x", `${vb.x}`);
        pattern.setAttribute("y", `${vb.y}`);
        pattern.setAttribute("width", `${this._gridWidth}`);
        pattern.setAttribute("height", `${this._gridHeight}`);
    
        this.defs.appendChild(pattern);

        var rect = document.createElementNS("http://www.w3.org/2000/svg","rect");
        rect.setAttribute("x", "0");
        rect.setAttribute("y", "0");
        rect.setAttribute("width", `${this._gridWidth}`);
        rect.setAttribute("height", `${this._gridHeight}`);
        rect.setAttribute("fill", "transparent");
        rect.setAttribute("stroke", "black");
        rect.setAttribute("stroke-width", `${to_svg(grid_line_width)}`);
    
        pattern.appendChild(rect);
    
        this.gridBg.setAttribute("fill", `url(#${pattern_id})`);
    }
}

var view : View;

var tblProperty : HTMLTableElement;
var angle_dlg : HTMLDialogElement;
var angle_dlg_ok : HTMLInputElement;
var angle_dlg_color : HTMLInputElement;

export class Vec2 {
    x: number;
    y: number;

    static fromObj(obj:any): Vec2 {
        return new Vec2(obj.x, obj.y);
    }

    constructor(x:number, y: number){
        this.x = x;
        this.y = y;
    }

    toJSON(key){
        var obj = { type_name: Vec2.name };
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

    len(): number {
        return Math.sqrt(this.x * this.x + this.y * this.y);
    }

    dist(pt:Vec2) : number {
        var dx = pt.x - this.x;
        var dy = pt.y - this.y;

        return Math.sqrt(dx * dx + dy * dy);
    }

    dot(pt:Vec2) : number{
        return this.x * pt.x + this.y * pt.y;
    }

    unit() : Vec2{
        var d = this.len();

        if(d == 0){

            return new Vec2(0, 0);
        }

        return new Vec2(this.x / d, this.y / d);
    }
}

class Mat2 {
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
        var det = this.det();
        console.assert(det != 0);

        return new Mat2(this.a22 / det, - this.a12 / det, - this.a21 / det, this.a11 / det)
    }
}

function to_svg(x:number) : number{
    return x * view.svg_ratio;
}

function get_svg_point(ev: MouseEvent | PointerEvent, dragged_point: Point|null){
	var point = view.svg.createSVGPoint();
	
    //画面上の座標を取得する．
    point.x = ev.offsetX;
    point.y = ev.offsetY;

    //座標に逆行列を適用する．
    var p = point.matrixTransform(view.CTMInv);    

    if(view.flipY){

        p.y = - p.y;
    }

    if(view.snapToGrid){

        var ele = document.elementFromPoint(ev.clientX, ev.clientY);
        if(ele == view.svg || ele == view.gridBg || (dragged_point != null && ele == dragged_point.circle)){
            p.x = Math.round(p.x / view.gridWidth ) * view.gridWidth;
            p.y = Math.round(p.y / view.gridHeight) * view.gridHeight;
        }
    }

    return new Vec2(p.x, p.y);
}

function click_handle(ev: MouseEvent, pt:Vec2) : Point{
    var handle = get_point(ev);
    if(handle == null){

        var line = get_line(ev);
        if(line != null){

            handle = initPoint(pt);
            line.adjust(handle);

            line.bind(handle)
        }
        else{
            var circle = get_circle(ev);
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
    var v = [];
    var min_len = Math.min(v1.length, v2.length);
    for(var i = 0; i < min_len; i++){
        v.push([v1[i], v2[i]])
    }

    return v;
}

class ShapeEvent{
    destination: Shape;
    sources: Shape[];

    constructor(destination: Shape, sources: Shape[]){
        this.destination = destination;
        this.sources = sources;
    }
}

class EventQueue {
    events : ShapeEvent[] = [];

    add_event(destination:Shape, source: Shape){
        var event = this.events.find(x=>x.destination == destination);
        if(event == undefined){
            this.events.push( new ShapeEvent(destination, [source]) );
        }
        else{
            if(!event.sources.includes(source)){

                event.sources.push(source);
            }
        }
    }

    add_event_make_event_graph(destination:Shape, source: Shape){
        this.add_event(destination, source);
        destination.make_event_graph(source);
    }

    process_queue =()=>{
        var processed : Shape[] = [];

        while(this.events.length != 0){
            var event = this.events[0];
            if(! processed.includes(event.destination)){
                processed.push(event.destination);

                event.destination.process_event(event.sources);
            }
            this.events.shift();
        }
    }
}

export abstract class Shape extends Action {
    handles : Point[] = [];
    shape_listeners:Shape[] = [];

    process_event(sources: Shape[]){}

    select(selected: boolean){}

    click =(ev: MouseEvent, pt:Vec2): void => {}
    pointermove = (ev: PointerEvent) : void => {}

    constructor(){
        super();

        view.shapes.set(this.id, this);
    }

    initChildren(children:Shape[]){
        for(let x of children){
            if(x != null){
                x.init();
            }
        }
    }

    add_handle(handle: Point, use_this_handle_move: boolean = true){

        if(use_this_handle_move){

            handle.shape_listeners.push(this);
        }
        this.handles.push(handle);
    }

    bind(pt: Point){
        this.shape_listeners.push(pt);
        pt.bind_to = this;
    }

    make_event_graph(src:Shape|null){
        for(let shape of this.shape_listeners){
            
            view.event_queue.add_event_make_event_graph(shape, this);
        }
    }
}

function finish_tool(){
    var v = Array.from(view.G0.childNodes.values());
    for(let x of v){
        view.G0.removeChild(x);
        view.G1.appendChild(x);
    }

    for(let x of view.selected_shapes){
        x.select(false);
    }
    view.selected_shapes = [];

    actions.push(view.tool);
    divActions.appendChild(view.tool.summaryDom());
    view.tool = null;
}

function get_point(ev: MouseEvent) : Point | null{
    var pt = Array.from(view.shapes.values()).find(x => x.constructor.name == "Point" && (x as Point).circle == ev.target) as (Point|undefined);
    return pt == undefined ? null : pt;
}

function get_line(ev: MouseEvent) : LineSegment | null{
    var line = Array.from(view.shapes.values()).find(x => x instanceof LineSegment && (x as LineSegment).line == ev.target && (x as LineSegment).handles.length == 2) as (LineSegment|undefined);
    return line == undefined ? null : line;
}

function get_circle(ev: MouseEvent) : Circle | null{
    var circle = Array.from(view.shapes.values()).find(x => x.constructor.name == "Circle" && (x as Circle).circle == ev.target && (x as Circle).handles.length == 2) as (Circle|undefined);
    return circle == undefined ? null : circle;
}

function lines_intersection(l1:LineSegment, l2:LineSegment) : Vec2 {
    l1.set_vecs();
    l2.set_vecs();

    /*
    l1.p1 + u l1.p12 = l2.p1 + v l2.p12

    l1.p1.x + u l1.p12.x = l2.p1.x + v l2.p12.x
    l1.p1.y + u l1.p12.y = l2.p1.y + v l2.p12.y

    l1.p12.x, - l2.p12.x   u = l2.p1.x - l1.p1.x
    l1.p12.y, - l2.p12.y   v = l2.p1.y - l1.p1.y
    
    */
    var m = new Mat2(l1.p12.x, - l2.p12.x, l1.p12.y, - l2.p12.y);
    var v = new Vec2(l2.p1.x - l1.p1.x, l2.p1.y - l1.p1.y);
    var mi = m.inv();
    var uv = mi.dot(v);
    var u = uv.x;

    return l1.p1.add(l1.p12.mul(u));
}

function calc_foot_of_perpendicular(pos:Vec2, line: LineSegment) : Vec2 {
    var p1 = line.handles[0].pos;
    var p2 = line.handles[1].pos;

    var e = p2.sub(p1).unit();
    var v = pos.sub(p1);
    var h = e.dot(v);

    var foot = p1.add(e.mul(h));

    return foot;
}

class SvgAction extends Action {
    svg: SVGSVGElement;

    constructor(){
        super();
    }

    init(){
    }
}

export class Point extends Shape {
    pos : Vec2;
    circle : SVGCircleElement;
    bind_to: Shape|null = null;

    pos_in_line: number|undefined;
    angle_in_circle: number|undefined;

    constructor(pt:Vec2){
        super();
        this.pos = pt;
        //---------- 
        this.circle = document.createElementNS("http://www.w3.org/2000/svg","circle");
        this.circle.setAttribute("r", `${to_svg(5)}`);
        this.circle.setAttribute("fill", "blue");
        this.circle.addEventListener("pointerdown", this.pointerdown);
        this.circle.addEventListener("pointermove", this.pointermove);
        this.circle.addEventListener("pointerup", this.pointerup);

        this.circle.style.cursor = "pointer";

        this.set_pos();
    
        view.G2.appendChild(this.circle);
    }

    makeObj(obj){
        Object.assign(obj, { pos: this.pos });
    }

    summary() : string {
        return "点";
    }

    get x(){
        return this.pos.x;
    }

    set x(value:any){
        this.pos.x =  parseInt(value);
        this.set_pos();
    }

    get y(){
        return this.pos.y;
    }

    set y(value:any){
        this.pos.y =  parseInt(value);
        this.set_pos();
    }

    click =(ev: MouseEvent, pt:Vec2): void => {
        this.pos = pt;

        var line = get_line(ev);

        if(line == null){

            this.set_pos();
        }
        else{

            line.bind(this)
            line.adjust(this);
        }

        finish_tool();
    }

    set_pos(){
        this.circle.setAttribute("cx", "" + this.pos.x);
        this.circle.setAttribute("cy", "" + this.pos.y);
    }

    select(selected: boolean){
        if(selected){
            if(! view.selected_shapes.includes(this)){
                view.selected_shapes.push(this);
                this.circle.setAttribute("fill", "orange");
            }
        }
        else{

            this.circle.setAttribute("fill", "blue");
        }
    }

    private dragPoint(ev: PointerEvent){
        this.pos = get_svg_point(ev, this);
        if(this.bind_to != null){

            if(this.bind_to instanceof LineSegment){
                    (this.bind_to as LineSegment).adjust(this);
            }
            else if(this.bind_to.constructor.name == "Circle"){
                (this.bind_to as Circle).adjust(this);
            }
        }
        else{

            this.set_pos();
        }
    }

    process_event =(sources: Shape[])=>{
        if(this.bind_to != null){

            if(this.bind_to instanceof LineSegment){
                    (this.bind_to as LineSegment).adjust(this);
            }
            else if(this.bind_to.constructor.name == "Circle"){
                (this.bind_to as Circle).adjust(this);
            }
        }
    }

    pointerdown =(ev: PointerEvent)=>{
        if(view.tool_type != "select"){
            return;
        }

        view.capture = this;
        this.circle.setPointerCapture(ev.pointerId);
    }

    pointermove =(ev: PointerEvent)=>{
        if(view.tool_type != "select"){
            return;
        }

        if(view.capture != this){
            return;
        }

        this.dragPoint(ev);

        this.make_event_graph(null);
        view.event_queue.process_queue();
    }

    pointerup =(ev: PointerEvent)=>{
        if(view.tool_type != "select"){
            return;
        }

        this.circle.releasePointerCapture(ev.pointerId);
        view.capture = null;

        this.dragPoint(ev);

        this.make_event_graph(null);
        view.event_queue.process_queue();
    }
}

class LineSegment extends Shape {    
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
        this.line.setAttribute("stroke-width", `${to_svg(stroke_width)}`);

        view.G0.appendChild(this.line);
    }

    init(){
        super.init();

        for(let p of this.handles){
            p.shape_listeners.push(this);
        }
    }

    *restore(){
        this.update_pos();
    }

    get color(){
        return this.line.getAttribute("stroke");
    }

    set color(c:string){
        this.line.setAttribute("stroke", c);
    }
    
    select(selected: boolean){
        if(selected){
            if(! view.selected_shapes.includes(this)){
                view.selected_shapes.push(this);
                this.line.setAttribute("stroke", "orange");
            }
        }
        else{

            this.line.setAttribute("stroke", "navy");
        }
    }

    set_poins(p1:Vec2, p2:Vec2){
        this.line.setAttribute("x1", "" + p1.x);
        this.line.setAttribute("y1", "" + p1.y);

        this.line.setAttribute("x2", "" + p2.x);
        this.line.setAttribute("y2", "" + p2.y);

        if(this.handles.length != 0){
            this.handles[0].pos = p1;

            if(this.handles.length == 2){
                this.handles[1].pos = p2;
                this.handles[1]

                this.set_vecs();
            }
        }
    }

    update_pos(){
        this.line.setAttribute("x1", "" + this.handles[0].pos.x);
        this.line.setAttribute("y1", "" + this.handles[0].pos.y);

        if(this.handles.length == 1){

            this.line.setAttribute("x2", "" + this.handles[0].pos.x);
            this.line.setAttribute("y2", "" + this.handles[0].pos.y);
        }
        else{

            this.line.setAttribute("x2", "" + this.handles[1].pos.x);
            this.line.setAttribute("y2", "" + this.handles[1].pos.y);

            this.set_vecs();
        }
    }

    process_event =(sources: Shape[])=>{
        for(let src of sources){
            if(src == this.handles[0]){

                var handle: Point = this.handles[0];
                this.line.setAttribute("x1", "" + handle.pos.x);
                this.line.setAttribute("y1", "" + handle.pos.y);
            }
            else if(src == this.handles[1]){
                
                var handle: Point = this.handles[1];
                this.line.setAttribute("x2", "" + handle.pos.x);
                this.line.setAttribute("y2", "" + handle.pos.y);
            }
            else{
                console.assert(src instanceof Rect || src instanceof ParallelLine);
            }
        }

        this.set_vecs();
    }

    click =(ev: MouseEvent, pt:Vec2): void => {
        this.add_handle(click_handle(ev, pt));

        this.line.setAttribute("x2", "" + pt.x);
        this.line.setAttribute("y2", "" + pt.y);
        if(this.handles.length == 1){

            this.line.setAttribute("x1", "" + pt.x);
            this.line.setAttribute("y1", "" + pt.y);
        }
        else{
            this.line.style.cursor = "move";
            this.set_vecs();

            finish_tool();
        }    

    }

    pointermove =(ev: PointerEvent) : void =>{
        var pt = get_svg_point(ev, null);

        this.line!.setAttribute("x2", "" + pt.x);
        this.line!.setAttribute("y2", "" + pt.y);
    }

    set_vecs(){
        this.p1 = this.handles[0].pos;
        this.p2 = this.handles[1].pos;
        this.p12 = this.p2.sub(this.p1);
        this.e = this.p12.unit();
        this.len = this.p12.len();
    }

    adjust(handle: Point) {
        if(this.len == 0){
            handle.pos_in_line = 0;
        }
        else{
            handle.pos_in_line = this.e.dot(handle.pos.sub(this.p1)) / this.len;
        }
        handle.pos = this.p1.add(this.p12.mul(handle.pos_in_line));
        handle.set_pos();
    }
}

class Rect extends Shape {
    is_square: boolean;
    lines : Array<LineSegment> = [];
    h : number = -1;
    in_set_rect_pos : boolean = false;

    constructor(is_square: boolean){
        super();
        this.is_square = is_square;
    }

    init(){
        super.init();

        this.handles.slice(0, 3).forEach(x => x.shape_listeners.push(this));

        this.lines.forEach(x => x.init());
    }

    *restore(){
        for(let line of this.lines){

            yield* line.restore();
        }
    }

    makeObj(obj){
        Object.assign(obj, {
            is_square: this.is_square,
            lines: this.lines.map(x => x.toObj())
        });
    }

    set_rect_pos(pt: Vec2|null, idx: number, clicked:boolean){
        if(this.in_set_rect_pos){
            return;
        }
        this.in_set_rect_pos = true;

        var p1 = this.handles[0].pos; 

        var p2;

        if(this.handles.length == 1){

            p2 = pt!;
        }
        else{

            p2 = this.handles[1].pos; 
        }

        var p12 = p2.sub(p1);

        var e = (new Vec2(- p12.y, p12.x)).unit();

        var h;
        if(this.is_square){

            h = p12.len();
        }
        else{

            if(this.h == -1 || idx == 2){

                var pa;
                if(this.handles.length < 4){
        
                    pa = pt!;
        
                }
                else{
        
                    pa = this.handles[2].pos; 
                }
        
                var p0a = pa.sub(p1);
                h = e.dot(p0a);
    
                if(this.handles.length == 4){
                    this.h = h;
                }
            }
            else{
                h = this.h;
            }
        }

        var eh = e.mul(h);
        var p3 = p2.add(eh);
        var p4 = p3.add(p1.sub(p2));

        var line1 = this.lines[0];
        line1.set_poins(p1, p2);

        var line2 = this.lines[1];
        line2.set_poins(p2, p3);

        var line3 = this.lines[2];
        line3.set_poins(p3, p4);

        var line4 = this.lines[3];
        line4.set_poins(p4, p1);

        if(clicked){
            if(this.handles.length == 2 && this.is_square){

                line1.add_handle(this.handles[1], false);
                line2.add_handle(this.handles[1], false);

                line1.line.style.cursor = "move";
                
                var handle3 = initPoint(p3);
                this.handles.push(handle3);
            }

            switch(this.handles.length){
            case 1:
                line1.add_handle(this.handles[0], false);
                break;
            case 2:
                line1.add_handle(this.handles[1], false);
                line2.add_handle(this.handles[1], false);

                line1.line.style.cursor = "move";

                break;
            case 3:
                line2.add_handle(this.handles[2], false);
                line2.line.style.cursor = "move";

                var handle4 = initPoint(p4);
                this.handles.push(handle4);

                line3.add_handle(this.handles[2], false);
                line3.add_handle(handle4, false);
                line3.line.style.cursor = "move";

                line4.add_handle(handle4, false);
                line4.add_handle(this.handles[0], false);
                line4.line.style.cursor = "move";
                break;
            }
        }

        if(3 <= this.handles.length){

            this.handles[2].pos = p3;
            this.handles[2].set_pos();
    
            if(this.handles.length == 4){

                this.handles[3].pos = p4;
                this.handles[3].set_pos();        
            }
        }

        this.in_set_rect_pos = false;
    }

    make_event_graph(src:Shape|null){
        super.make_event_graph(src);

        // event_queue.add_event_make_event_graph(this.handles[0], this);

        if(src == this.handles[0] || src == this.handles[1]){

            view.event_queue.add_event_make_event_graph(this.handles[2], this);
        }
        else{
            console.assert(src == this.handles[2]);
        }

        for(let line of this.lines){

            view.event_queue.add_event_make_event_graph(line, this);
        }
    }

    process_event =(sources: Shape[])=>{
        for(let source of sources){
            console.assert(source.constructor.name == "Point");
            var i = this.handles.indexOf(source as Point);
            console.assert([0, 1, 2].includes(i));
        }

        var handle = sources[0] as Point;

        var idx = this.handles.indexOf(handle);
        this.set_rect_pos(handle.pos, idx, false);
    }

    click =(ev: MouseEvent, pt:Vec2): void =>{
        if(this.lines.length == 0){

            for(var i = 0; i < 4; i++){

                var line = initLineSegment();
                this.lines.push(line);
            }
        }

        this.add_handle(click_handle(ev, pt));

        this.set_rect_pos(pt, -1, true);

        if(this.handles.length == 4){

            for(let line of this.lines){
                console.assert(line.handles.length == 2);
                line.set_vecs();
            }
            finish_tool();
        }    
    }

    pointermove =(ev: PointerEvent) : void =>{
        var pt = get_svg_point(ev, null);

        this.set_rect_pos(pt, -1, false);
    }
}

class Circle extends Shape {
    circle: SVGCircleElement;
    center: Vec2|null = null;
    radius: number = to_svg(1);
    by_diameter:boolean 

    constructor(by_diameter:boolean){
        super();

        this.by_diameter = by_diameter;
        //---------- 
        this.circle = document.createElementNS("http://www.w3.org/2000/svg","circle");
        this.circle.setAttribute("fill", "none");// "transparent");
        this.circle.setAttribute("stroke", "navy");
        this.circle.setAttribute("stroke-width", `${to_svg(stroke_width)}`);     
        this.circle.setAttribute("fill-opacity", "0");
        
        view.G0.appendChild(this.circle);    
    }

    init(){
        super.init();

    }

    *restore(){
        for(let p of this.handles){
            p.shape_listeners.push(this);
        }

        this.process_event(this.handles);
    }

    makeObj(obj){
        Object.assign(obj, { by_diameter: this.by_diameter });
    }

    get color(){
        return this.circle.getAttribute("stroke");
    }

    set color(c:string){
        this.circle.setAttribute("stroke", c);
    }

    set_center(pt: Vec2){
        this.center = this.handles[0].pos.add(pt).mul(0.5);

        this.circle.setAttribute("cx", "" + this.center.x);
        this.circle.setAttribute("cy", "" + this.center.y);
    }

    set_radius(pt: Vec2){
        this.radius = this.center!.dist(pt);
        this.circle!.setAttribute("r", "" +  this.radius );
    }

    process_event =(sources: Shape[])=>{
        for(let src of sources){
            if(src == this.handles[0]){

                if(this.by_diameter){

                    this.set_center(this.handles[1].pos);
                }
                else{
        
                    this.center = this.handles[0].pos;
                    this.circle.setAttribute("cx", "" + this.handles[0].pos.x);
                    this.circle.setAttribute("cy", "" + this.handles[0].pos.y);
                }
        
                this.set_radius(this.handles[1].pos);
            }
            else if(src == this.handles[1]){

                if(this.by_diameter){
                    this.set_center(this.handles[1].pos);
                }

                this.set_radius(this.handles[1].pos);
            }
            else{
                console.assert(false);
            }
        }
    }

    click =(ev: MouseEvent, pt:Vec2): void =>{
        this.add_handle(click_handle(ev, pt));

        if(this.handles.length == 1){

            this.center = pt;

            this.circle.setAttribute("cx", "" + pt.x);
            this.circle.setAttribute("cy", "" + pt.y);
            this.circle.setAttribute("r", "" + this.radius);
        }
        else{
            if(this.by_diameter){

                this.set_center(pt);
            }
    
            this.set_radius(pt);
            this.circle.style.cursor = "move";
    
            finish_tool();
        }
    }

    pointermove =(ev: PointerEvent) : void =>{
        var pt = get_svg_point(ev, null);

        if(this.by_diameter){

            this.set_center(pt);
        }
        this.set_radius(pt);
    }

    adjust(handle: Point) {
        var v = handle.pos.sub(this.center!);
        var theta = Math.atan2(v.y, v.x);

        handle.pos = new Vec2(this.center!.x + this.radius * Math.cos(theta), this.center!.y + this.radius * Math.sin(theta));
        handle.angle_in_circle = theta;

        handle.set_pos();
    }
}

class Triangle extends Shape {
    lines : Array<LineSegment> = [];

    makeObj(obj){
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
        var line = initLineSegment();

        if(this.lines.length == 0){
            line.add_handle(click_handle(ev, pt));
        }
        else{

            var last_line = array_last(this.lines);
            var handle = click_handle(ev, pt);
            last_line.add_handle(handle);
            last_line.update_pos();
            last_line.line.style.cursor = "move";

            line.add_handle(handle);
        }

        if(this.lines.length == 2){

            var handle1 = this.lines[0].handles[0];

            line.add_handle(handle1);
            line.line.style.cursor = "move";

            finish_tool();
        }

        this.lines.push(line);
        line.update_pos();
    }

    pointermove =(ev: PointerEvent) : void =>{
        var last_line = array_last(this.lines);
        last_line.pointermove(ev);
    }
}

class TextBox extends Shape {
    static dialog : HTMLDialogElement;
    static text_box : TextBox;    
    text: string;
    rect   : SVGRectElement;
    div : HTMLDivElement | null = null;
    clicked_pos : Vec2|null = null;
    offset_pos : Vec2|null = null;
    typeset_done: boolean;

    static ontypeset(self: TextBox){
        var rc = self.div!.getBoundingClientRect();
        self.rect.setAttribute("width", `${to_svg(rc.width)}`);

        var h = to_svg(rc.height);
        self.rect.setAttribute("y", `${self.clicked_pos!.y}`);
        self.rect.setAttribute("height", `${h}`);

        self.typeset_done = true;
    }

    static ok_click(){
        var self = TextBox.text_box;

        var text = (document.getElementById("text-box-text") as HTMLTextAreaElement).value;
        self.text = text;
        self.div!.innerHTML = make_html_lines(text);
        TextBox.dialog.close();

        self.typeset_done = false;
        MathJax.Hub.Queue(["Typeset",MathJax.Hub]);
        MathJax.Hub.Queue([TextBox.ontypeset, self]);
    }

    static initDialog(){
        TextBox.dialog = document.getElementById('text-box-dlg') as HTMLDialogElement;
        (document.getElementById("text-box-ok") as HTMLInputElement).addEventListener("click", TextBox.ok_click);
    }

    constructor(){
        super();
        TextBox.text_box = this;
        //---------- 
        this.rect = document.createElementNS("http://www.w3.org/2000/svg","rect");
        this.rect.setAttribute("width", `${to_svg(1)}`);
        this.rect.setAttribute("height", `${to_svg(1)}`);
        this.rect.setAttribute("fill", "transparent");
        this.rect.setAttribute("stroke", "navy");
        this.rect.setAttribute("stroke-width", `${to_svg(this_stroke_width)}`);
        view.G1.appendChild(this.rect);

        this.div = document.createElement("div");
        this.div.style.position = "absolute";
        this.div.style.backgroundColor = "cornsilk"
        view.div.appendChild(this.div);
    }

    *restore(){
        this.rect.setAttribute("x", "" + this.clicked_pos.x);
        this.rect.setAttribute("y", "" + this.clicked_pos.y);

        this.div.style.left  = `${this.offset_pos.x}px`;
        this.div.style.top   = `${this.offset_pos.y}px`;

        this.div.innerHTML = make_html_lines(this.text);
        this.typeset_done = false;

        MathJax.Hub.Queue(["Typeset",MathJax.Hub]);
        MathJax.Hub.Queue([TextBox.ontypeset, this]);
        
        while(! this.typeset_done){
            yield;
        }
    }

    makeObj(obj){
        Object.assign(obj, {
            text: this.text,
            clicked_pos: this.clicked_pos,
            offset_pos: this.offset_pos
        });
    }

    click =(ev: MouseEvent, pt:Vec2) : void =>{
        this.clicked_pos = pt;
        this.offset_pos = new Vec2(ev.offsetX, ev.offsetY);

        this.rect.setAttribute("x", "" + pt.x);
        this.rect.setAttribute("y", "" + pt.y);

        var ev = window.event as MouseEvent;

        this.div.style.left  = `${this.offset_pos.x}px`;
        this.div.style.top   = `${this.offset_pos.y}px`;

        TextBox.dialog.showModal();
        finish_tool();
    }
}

class Midpoint extends Shape {
    midpoint : Point | null = null;

    init(){
        super.init();
        this.initChildren([this.midpoint]);
    }

    makeObj(obj){
        Object.assign(obj, { midpoint: this.midpoint.toObj() });
    }

    calc_midpoint(){
        var p1 = this.handles[0].pos;
        var p2 = this.handles[1].pos;

        return new Vec2((p1.x + p2.x)/2, (p1.y + p2.y)/2);
    }

    make_event_graph(src:Shape|null){
        super.make_event_graph(src);

        view.event_queue.add_event_make_event_graph(this.midpoint!, this);
    }

    process_event =(sources: Shape[])=>{
        this.midpoint!.pos = this.calc_midpoint();
        this.midpoint!.set_pos();
    }

    click =(ev: MouseEvent, pt:Vec2): void => {
        this.add_handle(click_handle(ev, pt));

        if(this.handles.length == 2){

            this.midpoint = initPoint( this.calc_midpoint() );

            finish_tool();
        }
    }
}


class Perpendicular extends Shape {
    line : LineSegment | null = null;
    foot : Point | null = null;
    perpendicular : LineSegment | null = null;
    in_handle_move: boolean = false;

    init(){
        super.init();
        this.initChildren([this.line, this.foot, this.perpendicular]);
    }

    *restore(){
        yield* this.perpendicular.restore();
    }
    
    makeObj(obj){
        Object.assign(obj, {
            line: this.line.toObj(),
            foot: this.foot.toObj(),
            perpendicular: this.perpendicular.toObj()
        });
    }

    make_event_graph(src:Shape|null){
        super.make_event_graph(src);

        view.event_queue.add_event_make_event_graph(this.foot!, this);
    }

    process_event =(sources: Shape[])=>{
        if(this.in_handle_move){
            return;
        }
        this.in_handle_move = true;

        this.foot!.pos = calc_foot_of_perpendicular(this.handles[0].pos, this.line!);
        this.foot!.set_pos();

        this.perpendicular!.set_poins(this.handles[0].pos, this.foot!.pos);

        this.in_handle_move = false;
    }

    click =(ev: MouseEvent, pt:Vec2): void => {
        if(this.handles.length == 0){

            this.add_handle(click_handle(ev, pt));
        }
        else {

            this.line = get_line(ev);
            if(this.line == null){
                return;
            }

            this.line.shape_listeners.push(this);

            this.foot = initPoint( calc_foot_of_perpendicular(this.handles[0].pos, this.line!) );

            this.perpendicular = initLineSegment();
            this.perpendicular.line.style.cursor = "move";
            this.perpendicular.add_handle(this.handles[0]);
            this.perpendicular.add_handle(this.foot, false);

            this.perpendicular.set_vecs();
            this.perpendicular.update_pos();

            finish_tool();
        }
    }
}

class ParallelLine extends Shape {
    line1 : LineSegment | null = null;
    line2 : LineSegment | null = null;
    point : Point|null = null;

    init(){
        this.line2.init();
    }

    *restore(){
        yield* this.line2.restore();
    }
    
    makeObj(obj){
        Object.assign(obj, {
            line1: this.line1.toObj(),
            line2: this.line2.toObj(),
            point: this.point.toObj()
        });
    }

    calc_parallel_line(){
        var p1 = this.point!.pos.add(this.line1!.e.mul(infinity));
        var p2 = this.point!.pos.sub(this.line1!.e.mul(infinity));

        this.line2!.set_poins(p1, p2);
    }

    make_event_graph(src:Shape|null){
        super.make_event_graph(src);

        view.event_queue.add_event_make_event_graph(this.line2!, this);
    }

    process_event =(sources: Shape[])=>{
        this.calc_parallel_line();
    }

    click =(ev: MouseEvent, pt:Vec2): void => {
        if(this.line1 == null){

            this.line1 = get_line(ev);
            if(this.line1 == null){
                return;
            }

            this.line1.select(true);
            this.line1.shape_listeners.push(this);
        }
        else {

            this.point = get_point(ev);
            if(this.point == null){
                return;
            }

            this.point.shape_listeners.push(this);

            this.line2 = initLineSegment();
            this.line2.line.style.cursor = "move";

            this.line2.add_handle(initPoint(new Vec2(0,0)));
            this.line2.add_handle(initPoint(new Vec2(0,0)));
            this.calc_parallel_line();
            for(let handle of this.line2.handles){
                handle.set_pos();
            }

            finish_tool();
        }
    }
}

class Intersection extends Shape {
    lines : LineSegment[] = [];
    intersection : Point|null = null;

    
    makeObj(obj){
        Object.assign(obj, {
            lines: this.lines.map(x => x.toObj()),
            intersection: this.intersection.toObj()
        });
    }

    make_event_graph(src:Shape|null){
        super.make_event_graph(src);

        view.event_queue.add_event_make_event_graph(this.intersection!, this);
    }

    process_event =(sources: Shape[])=>{
        this.intersection!.pos = lines_intersection(this.lines[0], this.lines[1]);
        this.intersection!.set_pos();
    }

    click =(ev: MouseEvent, pt:Vec2): void => {
        var line = get_line(ev);
        
        if(line != null){
            this.lines.push(line);

            if(this.lines.length == 1){


                line.select(true);
            }
            else{

                var v = lines_intersection(this.lines[0], this.lines[1]);
                this.intersection = initPoint(v);

                for(let line2 of this.lines){

                    line2.shape_listeners.push(this);
                }

                finish_tool();
            }
        }
    }

    pointermove = (ev: PointerEvent) : void => {
    }
}

class Angle extends Shape {
    lines : LineSegment[] = [];
    ts : number[] = [];
    arc: SVGPathElement|null = null;

    static current: Angle;

    constructor(){
        super();
        this.arc = document.createElementNS("http://www.w3.org/2000/svg","path");

        this.arc.setAttribute("fill", "none");
        this.arc.setAttribute("stroke", "red");
        this.arc.setAttribute("stroke-width", `${to_svg(this_stroke_width)}`);
        this.arc.addEventListener("click", this.arc_click);
        this.arc.style.cursor = "pointer";

        view.G0.appendChild(this.arc);
    }

    *restore(){
        this.draw_arc();
    }
    
    makeObj(obj){
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

    draw_arc(){
        var line1 = this.lines[0];
        var line2 = this.lines[1];

        var q1 = line1.p1.add(line1.p12.mul(this.ts[0]));
        var q2 = line2.p1.add(line2.p12.mul(this.ts[1]));

        var p = lines_intersection(this.lines[0], this.lines[1]);

        var sign1 = Math.sign(q1.sub(p).dot(line1.e));
        var sign2 = Math.sign(q2.sub(p).dot(line2.e));

        var r = to_svg(40);        
        var p1 = p.add(this.lines[0].e.mul(r * sign1));
        var p2 = p.add(this.lines[1].e.mul(r * sign2));

        var theta1 = Math.atan2(q1.y - p.y, q1.x - p.x);
        var theta2 = Math.atan2(q2.y - p.y, q2.x - p.x);

        if(theta1 < 0){
            theta1 += 2 * Math.PI;
        }
        if(theta2 < 0){
            theta2 += 2 * Math.PI;
        }
        
        var d_theta = theta2 - theta1;
        if(d_theta < 0){
            d_theta += 2 * Math.PI;
        }

        var large_arc_sweep_flag = (Math.PI < d_theta ? 1 : 0);

        var d = `M${p1.x} ${p1.y} A ${r} ${r} 0 ${large_arc_sweep_flag} 1 ${p2.x} ${p2.y}`;

        this.arc!.setAttribute("d", d);
    }

    process_event =(sources: Shape[])=>{
        this.draw_arc();
    }

    ok_click(){
        this.arc!.setAttribute("stroke", angle_dlg_color.value.trim());

        angle_dlg.close();
    }


    static initDialog(){
        angle_dlg = document.getElementById('angle-dlg') as HTMLDialogElement;
        angle_dlg_ok = document.getElementById('angle-dlg-ok') as HTMLInputElement;
        angle_dlg_color = document.getElementById('angle-dlg-color') as HTMLInputElement;

        angle_dlg.addEventListener("keydown", ev=>{
            if(ev.key == 'Enter'){
                Angle.current.ok_click();
            }    
        });

        angle_dlg_ok.addEventListener("click", ev=>{
            Angle.current.ok_click();    
        });
    
    }

    arc_click = (ev: MouseEvent)=>{
        Angle.current = this;
        angle_dlg_color.value = this.arc!.getAttribute("stroke")!;

        angle_dlg.showModal();
        // angle_dlg_ok.removeEventListener("click", this.ok_click);
    }

    click =(ev: MouseEvent, pt:Vec2): void => {
        var line = get_line(ev);
        
        if(line != null){
            this.lines.push(line);

            var t = pt.sub(line.p1).dot(line.e) / line.len;
            this.ts.push(t);

            if(this.lines.length == 1){


                line.select(true);
            }
            else{

                this.draw_arc();
        
                for(let line2 of this.lines){

                    line2.shape_listeners.push(this);
                }

                finish_tool();
            }
        }
    }

    pointermove = (ev: PointerEvent) : void => {
    }
}

function setToolType(){
    view.tool_type = (document.querySelector('input[name="tool-type"]:checked') as HTMLInputElement).value;  
}

function make_tool_by_type(tool_type: string): Shape|undefined {
    var v = tool_type.split('.');
    var type_name = v[0];
    var arg = v.length == 2 ? v[1] : null;

    switch(type_name){
        case "Point":         return new Point(new Vec2(0,0));
        case "LineSegment":  return new LineSegment();
        case "Rect":          return new Rect(arg == "2");
        case "Circle":       return new Circle(arg == "2");
        case "Triangle":      return new Triangle();
        case "Midpoint":      return new Midpoint();
        case "Perpendicular": return new Perpendicular()
        case "ParallelLine": return new ParallelLine()
        case "Intersection":  return new Intersection();
        case "Angle":         return new Angle();
        case "TextBox":      return new TextBox();
        case "Label":           return new Label();
    } 
}

function showProperty(obj: any){
    var proto = Object.getPrototypeOf(obj);

    tblProperty.innerHTML = "";

    for(let name of Object.getOwnPropertyNames(proto)){
        var desc = Object.getOwnPropertyDescriptor(proto, name);
        if(desc.get != undefined && desc.set != undefined){
            
            var tr = document.createElement("tr");

            var name_td = document.createElement("td");
            name_td.innerText = name;

            var value_td = document.createElement("td");

            var value = desc.get.apply(obj);
            
            var inp = document.createElement("input");
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
            value_td.appendChild(inp);

            tr.appendChild(name_td);
            tr.appendChild(value_td);

            tblProperty.appendChild(tr);
        }
    }
}


class Label extends Shape {
    text: SVGTextElement;

    constructor(){
        super();

        this.text = document.createElementNS("http://www.w3.org/2000/svg","text");
        if(view.flipY){
            
            this.text.setAttribute("transform", "matrix(1, 0, 0, -1, 0, 0)");
        }
        this.text.setAttribute("stroke", "navy");
        this.text.setAttribute("stroke-width", `${to_svg(stroke_width)}`);
        this.text.textContent = "こんにちは";
        this.text.style.fontSize = "1";

        view.G0.appendChild(this.text);
    }

    process_event =(sources: Shape[])=>{
        console.assert(sources.length == 1 && sources[0] == this.handles[0]);
        this.text.setAttribute("x", "" + this.handles[0].pos.x);
        this.text.setAttribute("y", "" + this.handles[0].pos.y);
    }

    click =(ev: MouseEvent, pt:Vec2): void => {
        this.add_handle(click_handle(ev, pt));

        this.text.setAttribute("x", "" + this.handles[0].pos.x);
        this.text.setAttribute("y", "" + this.handles[0].pos.y);
        finish_tool();
    }
}


export class Image extends Shape {
    image: SVGImageElement;

    constructor(arg: string){
        super();

        this.image = document.createElementNS("http://www.w3.org/2000/svg", "image") as SVGImageElement;
        if(view.flipY){
            
            this.image.setAttribute("transform", "matrix(1, 0, 0, -1, 0, 0)");
        }
        this.image.setAttribute("preserveAspectRatio", "none");
        setSvgImg(this.image, arg);

        view.G0.appendChild(this.image);
    
        this.image.addEventListener("load", (ev:Event) => {
            var rc = this.image.getBoundingClientRect();
            msg(`img loaded w:${rc.width} h:${rc.height}`);
    
            // 縦横比 = 縦 / 横
            var ratio = rc.height / rc.width;
    
            // viewBoxを得る。
            var vb = view.svg.viewBox.baseVal;
    
            // 縦横比を保って幅がsvgの半分になるようにする。
            var w = vb.width / 2;
            var h = ratio * vb.width / 2;
            this.image.setAttribute("width", `${w}`);
            this.image.setAttribute("height", `${h}`);
    
            // svgの中央に配置する。
            var x = vb.x + (vb.width  - w) / 2 ;
            var y = vb.y + (vb.height - h) / 2;
            this.image.setAttribute("x", `${x}`);
            this.image.setAttribute("y", `${y}`);
    
            this.add_handle(initPoint(new Vec2(x, y)));
            this.add_handle(initPoint(new Vec2(x + w, y + h)));
        });
    }
    

    make_event_graph(src:Shape|null){
        super.make_event_graph(src);

        if(src == this.handles[0]){

            view.event_queue.add_event_make_event_graph(this.handles[1], this);
        }
        else{
            console.assert(src == this.handles[1]);
        }
    }


    process_event =(sources: Shape[])=>{
        for(let src of sources){
            if(src == this.handles[0]){
                var x = this.handles[0].pos.x;
                var y = this.handles[0].pos.y;

                this.image.setAttribute("x", `${x}`);
                this.image.setAttribute("y", `${y}`);

                this.handles[1].pos.x = x + this.image.width.baseVal.value;
                this.handles[1].pos.y = y + this.image.height.baseVal.value;

                this.handles[1].set_pos();
            }
            else if(src == this.handles[1]){
                var w = this.handles[1].pos.x - this.handles[0].pos.x;
                var h = this.handles[1].pos.y - this.handles[0].pos.y;
                
                this.image.setAttribute("width", `${w}`);
                this.image.setAttribute("height", `${h}`);
            }
            else{
                console.assert(false);
            }
        }
    }
}


function svg_click(ev: MouseEvent){
    if(view.capture != null){
        return;
    }

    if(view.tool_type == "select"){

        for(let shape of view.shapes.values()){

            for(let name of Object.getOwnPropertyNames(shape)){
                var desc = Object.getOwnPropertyDescriptor(shape, name);

                if(desc.value == ev.srcElement){

                    showProperty(shape);
                    return
                }
            }        
        }

        showProperty(view);
        
        return;
    }

    var pt = get_svg_point(ev, null);

    if(view.tool == null){
        view.tool = make_tool_by_type(view.tool_type)!;
        console.assert(view.tool.typeName() == view.tool_type.split('.')[0]);
        view.tool.init();
    }

    if(view.tool != null){

        view.tool.click(ev, pt);
    }
}

function svg_pointermove(ev: PointerEvent){
    if(view.capture != null){
        return;
    }

    if(view.tool != null){
        view.tool.pointermove(ev);
    }
}

export function addShape(){
    var obj = {
        "_width" : "500px",
        "_height" : "500px",
        "_viewBox" : "-10 -10 20 20",
    };   

    var view1 = new View(obj);
    actions.push(view1);
    view1.init();
    divActions.appendChild(view1.summaryDom());
}

export function init_draw(){
    tblProperty = document.getElementById("tbl-property") as HTMLTableElement;

    TextBox.initDialog();

    var tool_types = document.getElementsByName("tool-type");
    for(let x of tool_types){
        x.addEventListener("click", setToolType);
    }

    Angle.initDialog();
}

export function deserializeShapes(obj:any) : Action {
    switch(obj["type_name"]){
    case View.name:
        return new View(obj);

    case Point.name:
        return new Point(new Vec2(obj.pos.x, obj.pos.y));

    case LineSegment.name:
        return new LineSegment();

    case Rect.name:
        return new Rect(obj.is_square);

    case Circle.name:
        return new Circle(obj.by_diameter);

    case Triangle.name:
        return new Triangle();

    case TextBox.name:
        return new TextBox();

    case Midpoint.name:
        return new Midpoint();

    case Perpendicular.name:
        return new Perpendicular();

    case ParallelLine.name:
        return new ParallelLine();

    case Intersection.name:
        return new Intersection();

    case Angle.name:
        return new Angle();

    default:
        return null;
    }
}
}