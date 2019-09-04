namespace manebu {
var toolType : string = "";

class Vec2 {
    x : number;
    y : number;

    constructor(x: number, y: number){
        this.x = x;
        this.y = y;
    }

    sub(p: Vec2) : Vec2 {
        return new Vec2(this.x - p.x, this.y - p.y);
    }

    add(p: Vec2) : Vec2 {
        return new Vec2(this.x + p.x, this.y + p.y);
    }

    mul(d: number) : Vec2{
        return new Vec2(d * this.x, d * this.y);
    }

    len() : number {
        return Math.sqrt(this.x * this.x + this.y * this.y);
    }

    unit() : Vec2 {
        var l = this.len();

        if(l == 0){
            return new Vec2(0, 0);
        }
        else{

            return new Vec2(this.x / l, this.y / l);
        }
    }
}

class Shape {
    constructor(){}    
}

class LineShape extends Shape {
    x1: number;
    x2: number;
    y1: number;
    y2: number;

    constructor(x1: number, x2: number, y1: number, y2: number){
        super();
        this.x1 = x1;
        this.x2 = x2;
        this.y1 = y1;
        this.y2 = y2;
    }
}

class CircleShape extends Shape {
    cx: number;
    cy: number;
    r : number;

    constructor(cx: number, cy: number, r: number){
        super();
        this.cx = cx;
        this.cy = cy;
        this.r  = r;
    }
}

class ArcShape extends Shape {
    p1  : Vec2;
    p2  : Vec2;
    p3  : Vec2;

    constructor(p1: Vec2, p2: Vec2, p3: Vec2){
        super();
        this.p1 = p1;
        this.p2 = p2;
        this.p3 = p3;
    }
}

class ShapeTool {
    svg: SVGSVGElement;
    finished : boolean = false;

    constructor(svg: SVGSVGElement){
        this.svg = svg;
    }

    move(x: number, y: number){}
    click(x: number, y: number){}
}

class LineTool extends ShapeTool {
    line     : LineShape;
    svg_line : SVGLineElement;

    constructor(svg: SVGSVGElement, x: number, y: number){
        super(svg);

        this.line = new LineShape(x, y, x, y);

        this.svg_line = document.createElementNS("http://www.w3.org/2000/svg", "line") as SVGLineElement;
        this.svg_line.setAttributeNS(null, "x1", "" + x);
        this.svg_line.setAttributeNS(null, "y1", "" + y);
        this.svg_line.setAttributeNS(null, "x2", "" + x);
        this.svg_line.setAttributeNS(null, "y2", "" + y);
        this.svg_line.setAttributeNS(null, "stroke", "red");
        this.svg_line.setAttributeNS(null, "fill", "none");
        this.svg_line.setAttributeNS(null, "stroke-width", "3");

        svg.appendChild(this.svg_line);
    }

    move(x: number, y: number){
        this.line.x2 = x;
        this.line.y2 = y;

        this.svg_line.setAttributeNS(null, "x2", "" + x);
        this.svg_line.setAttributeNS(null, "y2", "" + y);
    }

    click(x: number, y: number){
        this.move(x, y);

        var ins_str = '@line ' + JSON.stringify(this.line) + '\n';
        insertText(ins_str);    

        this.finished = true;
    }
}


class CircleTool extends ShapeTool {
    circle: CircleShape;
    svg_circle : SVGCircleElement;

    constructor(svg: SVGSVGElement, x: number, y: number){
        super(svg);

        this.circle = new CircleShape(x, y, 1);

        this.svg_circle = document.createElementNS("http://www.w3.org/2000/svg", "circle") as SVGCircleElement;
        this.svg_circle.setAttributeNS(null, "cx", "" + this.circle.cx);
        this.svg_circle.setAttributeNS(null, "cy", "" + this.circle.cy);
        this.svg_circle.setAttributeNS(null, "r", "1");
        this.svg_circle.setAttributeNS(null, "stroke", "red");
        this.svg_circle.setAttributeNS(null, "fill", "none");
        this.svg_circle.setAttributeNS(null, "stroke-width", "3");

        svg.appendChild(this.svg_circle);
    }

    move(x: number, y: number){
        var dx = x - this.circle.cx;
        var dy = y - this.circle.cy;
    
        this.circle.r = Math.sqrt(dx * dx + dy * dy);
        this.svg_circle.setAttributeNS(null, "r", "" + this.circle.r);
    }

    click(x: number, y: number){
        this.move(x, y);

        var ins_str = '@circle ' + JSON.stringify(this.circle) + '\n';
        insertText(ins_str);    

        this.finished = true;
    }
}


class ArcTool extends ShapeTool {
    arc: ArcShape;

    svg_arc : SVGPathElement;
    line : SVGLineElement;

    constructor(svg: SVGSVGElement, x: number, y: number){
        super(svg);

        this.arc = new ArcShape(new Vec2(x, y), null, null);

        this.svg_arc = document.createElementNS("http://www.w3.org/2000/svg", "path") as SVGPathElement;
        this.svg_arc.setAttributeNS(null, "stroke", "red");
        this.svg_arc.setAttributeNS(null, "fill", "none");
        this.svg_arc.setAttributeNS(null, "stroke-width", "3");

        svg.appendChild(this.svg_arc);

        this.line = document.createElementNS("http://www.w3.org/2000/svg", "line") as SVGLineElement;
        this.line.setAttributeNS(null, "x1", "" + x);
        this.line.setAttributeNS(null, "y1", "" + y);
        this.line.setAttributeNS(null, "x2", "" + x);
        this.line.setAttributeNS(null, "y2", "" + y);
        this.line.setAttributeNS(null, "stroke", "red");
        this.line.setAttributeNS(null, "fill", "none");
        this.line.setAttributeNS(null, "stroke-width", "3");

        svg.appendChild(this.line);
    }

    draw(x: number, y: number){
        var p3 : Vec2;

        if(this.arc.p3 == null){
            p3 = new Vec2(x,y);
        }
        else{
            p3 = this.arc.p3;
        }

        var r  = this.arc.p2.sub(this.arc.p1).len();

        var p4 = this.arc.p1.add( p3.sub(this.arc.p1).unit().mul(r) );

        var d = `M${this.arc.p2.x} ${this.arc.p2.y} A ${r} ${r} 0 0 0 ${p4.x} ${p4.y}`;

        this.svg_arc.setAttribute("d", d);
    }

    move(x: number, y: number){
        if(this.arc.p2 == null){

            this.line.setAttributeNS(null, "x2", "" + x);
            this.line.setAttributeNS(null, "y2", "" + y);
        }
        else{

            this.draw(x, y);
        }
    }

    click(x: number, y: number){
        if(this.arc.p2 == null){

            this.arc.p2 = new Vec2(x, y);
        }
        else{
            this.arc.p3 = new Vec2(x, y);

            this.draw(x, y);
    
            this.svg.removeChild(this.line);

            var ins_str = '@arc ' + JSON.stringify(this.arc) + '\n';
            insertText(ins_str);    
    
            this.finished = true;
        }
    }
}

var tool : ShapeTool;

export function init_shape(){
    var radio_buttons = document.getElementsByName("shape-tool");
    for(let button of radio_buttons){
        button.addEventListener("change", function(ev:Event){
            toolType = (button as HTMLInputElement).value;
        })
    }
}

export function addSVG(line: string, arg: string, ref_node: Node){
    var svg = document.createElementNS("http://www.w3.org/2000/svg","svg") as SVGSVGElement;
    svg.style.width = "500px";
    svg.style.height = "500px";
    svg.style.borderStyle = "groove";
    svg.style.borderWidth = "3px";

    svg.addEventListener("click", function(ev: MouseEvent){
        if(tool == null){

            switch(toolType){
            case "circle":
                tool = new CircleTool(svg, ev.offsetX, ev.offsetY);
                break;

            case "line":
                tool = new LineTool(svg, ev.offsetX, ev.offsetY);
                break;

            case "angle":
                tool = new ArcTool(svg, ev.offsetX, ev.offsetY);
                break;
            }
        }
        else{
            tool.click(ev.offsetX, ev.offsetY);

            if(tool.finished){
                tool = null;
            }
        }
    });

    svg.addEventListener("pointermove", function(ev: PointerEvent){
        if(tool == null){

            return;
        }

        tool.move(ev.offsetX, ev.offsetY);
    });

    var img2 = document.createElementNS("http://www.w3.org/2000/svg", "image") as SVGImageElement;
    svg.appendChild(img2);
    setSvgImg(img2, arg);

    img2.addEventListener("load", function(ev:Event){
        msg("img loaded");
        var rc = img2.getBoundingClientRect();
        msg(`w:${rc.width} h:${rc.height}`);

        svg.style.width  = `${rc.width}px`;
        svg.style.height = `${rc.height}px`;
    });

    var div = makeBlockDiv(line, ref_node);
    div.appendChild(svg);
}




}