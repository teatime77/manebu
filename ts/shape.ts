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

class ShapeTool {
    svg: SVGSVGElement;
    finished : boolean = false;

    constructor(svg: SVGSVGElement){
        this.svg = svg;
    }

    move(x: number, y: number){}
    click(x: number, y: number){}
}

class LineShape extends ShapeTool {
    line : SVGLineElement;

    constructor(svg: SVGSVGElement, x: number, y: number){
        super(svg);

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

    move(x: number, y: number){
        this.line.setAttributeNS(null, "x2", "" + x);
        this.line.setAttributeNS(null, "y2", "" + y);
    }

    click(x: number, y: number){
        this.move(x, y);
        this.finished = true;
    }
}


class CircleShape extends ShapeTool {
    circle : SVGCircleElement;
    cx : number;
    cy : number;

    constructor(svg: SVGSVGElement, x: number, y: number){
        super(svg);

        this.cx = x;
        this.cy = y;

        this.circle = document.createElementNS("http://www.w3.org/2000/svg", "circle") as SVGCircleElement;
        this.circle.setAttributeNS(null, "cx", "" + this.cx);
        this.circle.setAttributeNS(null, "cy", "" + this.cy);
        this.circle.setAttributeNS(null, "r", "1");
        this.circle.setAttributeNS(null, "stroke", "red");
        this.circle.setAttributeNS(null, "fill", "none");
        this.circle.setAttributeNS(null, "stroke-width", "3");

        svg.appendChild(this.circle);
    }

    move(x: number, y: number){
        var dx = x - this.cx;
        var dy = y - this.cy;
    
        var r = Math.sqrt(dx * dx + dy * dy);
        this.circle.setAttributeNS(null, "r", "" + r);
    }

    click(x: number, y: number){
        this.move(x, y);
        this.finished = true;
    }
}


class AngleShape extends ShapeTool {
    p1  : Vec2;
    p2  : Vec2 = null;
    p3  : Vec2 = null;

    arc : SVGPathElement;
    line : SVGLineElement;

    constructor(svg: SVGSVGElement, x: number, y: number){
        super(svg);

        this.p1 = new Vec2(x, y);

        this.arc = document.createElementNS("http://www.w3.org/2000/svg", "path") as SVGPathElement;
        this.arc.setAttributeNS(null, "stroke", "red");
        this.arc.setAttributeNS(null, "fill", "none");
        this.arc.setAttributeNS(null, "stroke-width", "3");

        svg.appendChild(this.arc);

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

        if(this.p3 == null){
            p3 = new Vec2(x,y);
        }
        else{
            p3 = this.p3;
        }

        var r  = this.p2.sub(this.p1).len();

        var p4 = this.p1.add( p3.sub(this.p1).unit().mul(r) );

        var d = `M${this.p2.x} ${this.p2.y} A ${r} ${r} 0 0 0 ${p4.x} ${p4.y}`;

        this.arc.setAttribute("d", d);
    }

    move(x: number, y: number){
        if(this.p2 == null){

            this.line.setAttributeNS(null, "x2", "" + x);
            this.line.setAttributeNS(null, "y2", "" + y);
        }
        else{

            this.draw(x, y);
        }
    }

    click(x: number, y: number){
        if(this.p2 == null){

            this.p2 = new Vec2(x, y);
        }
        else{
            this.p3 = new Vec2(x, y);

            this.draw(x, y);
    
            this.svg.removeChild(this.line);
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
                tool = new CircleShape(svg, ev.offsetX, ev.offsetY);
                break;

            case "line":
                tool = new LineShape(svg, ev.offsetX, ev.offsetY);
                break;

            case "angle":
                tool = new AngleShape(svg, ev.offsetX, ev.offsetY);
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