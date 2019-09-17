namespace manebu{
declare let MathJax:any;
export const padding = 10;
const endMark = "😀";
export let actionMap : Map<number, Action>;
let pendingRefs : any[];
let stopPlaying: boolean = false;

function ltrim(stringToTrim) {
	return stringToTrim.replace(/^\s+/,"");
}

export function arrayLast<T>(arr:T[]) : T{
    console.assert(arr.length != 0);
    return arr[arr.length - 1];
}

export function arrayRemove<T>(arr:T[], x:T) {
    const index = arr.indexOf(x);
    if (index != -1) {
        arr.splice(index, 1);
    }
}

function getIndent(line: string) : [number, string]{
    let indent = 0;
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

export function makeHtmlLines(text: string){
    const lines = text.split('\n');
    const htmlLines = [];            

    let inMath = false;
    let ulIndent = -1;
    let prevLine = "";
    for(let currentLine of lines){
        let currentLineTrim = currentLine.trim();

        let [indent, line] = getIndent(currentLine);
        indent--;

        if(currentLineTrim == "$$"){
            inMath = ! inMath;
            htmlLines.push(currentLine);
        }
        else{
            if(inMath){

                htmlLines.push(currentLine);
            }
            else{

                if(line.startsWith("# ")){
                    htmlLines.push(tab(indent + 1) + "<strong><span>" + line.substring(2) + "</span></strong><br/>")
                }
                else if(line.startsWith("- ")){
                    if(ulIndent < indent){
                        console.assert(ulIndent + 1 == indent);
                        htmlLines.push(tab(indent) + "<ul>")
                        ulIndent++;
                    }
                    else{
                        while(ulIndent > indent){
                            htmlLines.push(tab(ulIndent) + "</ul>")
                            ulIndent--;
                        }                            
                    }
                    htmlLines.push(tab(indent + 1) + "<li><span>" + line.substring(2) + "</span></li>")
                }
                else{

                    if(prevLine.endsWith("</li>")){
                        htmlLines[htmlLines.length - 1] = prevLine.substring(0, prevLine.length - 5) + "<br/>";
                        htmlLines.push(tab(indent + 1) + "<span>" + line + "</span></li>")
                    }
                    else{

                        htmlLines.push(tab(indent + 1) + "<span>" + line + "</span><br/>")
                    }
                }
            }
        }

        prevLine = htmlLines[htmlLines.length - 1];
    }

    while(ulIndent != -1){
        htmlLines.push(tab(ulIndent) + "</ul>")
        ulIndent--;
    }

    return htmlLines.join("\n");
}

export function tostr(text: string){
    if(! text.includes('\n')){
        return JSON.stringify(text);
    }
    else{
        return `${endMark}${text}${endMark}`;
    }
}

function objToStr(obj: any, nest: number){
    const t1 = " ".repeat(4 * nest);
    const t2 = " ".repeat(4 * (nest + 1));

    if(Array.isArray(obj)){
        return `${t1}[\n` + (obj as any[]).map(x => objToStr(x, nest + 1)).join(`,\n`) + `\n${t1}]`;
    }

    if(typeof obj == "object"){

        if(obj.ref != undefined){
            
            return `${t1}{ "ref": ${obj.ref} }`;
        }

        if(obj.typeName == Point.name && obj.listeners == undefined && obj.bind_to == undefined){

            return `${t1}{ "typeName": "${obj.typeName}", "id": ${obj.id}, "pos": { "typeName": "${Vec2.name}", "x": ${obj.pos.x}, "y": ${obj.pos.y} } }`;
        }

        if(obj.constructor.name == Vec2.name){
            
            return `${t1}{ "typeName": "${Vec2.name}", "x": ${obj.x}, "y": ${obj.y} }`;
        }

        if(obj.typeName == "TextBox"){
            msg(``);
        }

        let lines = [];
        for (let [key, value] of Object.entries(obj)){
            lines.push(`${t2}"${key}": ${ltrim(objToStr(value, nest + 1))}`)
        }
        
        return `${t1}{\n` + lines.join(`,\n`) + `\n${t1}}`;
    }

    if(typeof obj == "string"){
        if(obj.includes('\n')){
            return `${endMark}${obj}${endMark}`;
        }
    }

    return JSON.stringify(obj);
}


export function fromObj(parent:any, key:any, obj: any){
    if(Array.isArray(obj)){

        let v = [];
        for(let [i, x] of (obj as any[]).entries()){
            v.push( fromObj(v, i, x) );
        }

        return v;
    }

    if(typeof obj == "object"){
        msg(`${obj.id} ${obj.typeName}`)

        let act;

        if(obj.ref != undefined){
            
            if(actionMap.has(obj.ref)){
                return actionMap.get(obj.ref);
            }
            else{
                
                pendingRefs.push({ parent:parent, key:key, ref: obj.ref });
                return obj;
            }
        }

        if(obj.typeName == Vec2.name){
            
            return new Vec2(obj.x, obj.y);
        }

        switch(obj["typeName"]){
        case TextBlockAction.name:
            act = new TextBlockAction(obj.text);
            break;
        case SpeechAction.name:
            act = new SpeechAction(obj.text);
            break;
        case SelectionAction.name:
            act = new SelectionAction(obj.block_id, obj.dom_type, obj.start_path, obj.end_path);
            break;
        case UnselectionAction.name:
            act = new UnselectionAction();
            break;

        case EndAction.name:
        case ShapeAction.name:
            console.assert(false);

        default:
            act = deserializeShapes(obj);
            console.assert(act != null);
            break;
        }

        for (let [key, value] of Object.entries(obj)){
            act[key] = fromObj(obj, key, value);
        }

        console.assert(!actionMap.has(act.id));
        actionMap.set(act.id, act);

        return act;
    }

    return obj;
}

export function serializeActions() : string {
    for(let [i,x] of allActions.entries()){
        x.id = i;
    }
    actionMap = new Map<number, Action>();

    const actionObjs = actions.map(x => x.toObj());

    return objToStr(actionObjs, 0);
}

export function reviseJson(text:string){
    let ret = "";

    const el = endMark.length;
    while(true){
        let k1 = text.indexOf(endMark);
        if(k1 == -1){
            return ret + text;
        }

        let k2 = text.indexOf(endMark, k1 + el);
        console.assert(k2 != -1);

        ret += text.substring(0, k1) + JSON.stringify(text.substring(k1 + el, k2));
        text = text.substring(k2 + el);
    }
}

export function deserializeActions(text: string){
    const obj = JSON.parse(reviseJson(text));

    actionMap = new Map<number, Action>();
    pendingRefs = [];
    actions = fromObj(null,null, obj);

    for(let pending of pendingRefs){
        console.assert(actionMap.has(pending.ref));

        let act = actionMap.get(pending.ref);
        pending.parent[pending.key] = act;
    }
}


function* waitActions(){
    let typesetDone = false;
    MathJax.Hub.Queue(["Typeset",MathJax.Hub]);
    MathJax.Hub.Queue([function(){
        typesetDone = true;
    }]);

    while(! typesetDone){
        yield;
    }

    divMath.scrollTop = divMath.scrollHeight;
}

export function runGenerator(gen: IterableIterator<any>){
    stopPlaying = false;

    const id = setInterval(function(){
        const ret = gen.next();
        if(ret.done || stopPlaying){        

            clearInterval(id);
            msg("停止しました。");
        }
    },100);
}

export function openActionData(actionText: string){
    divMath.innerHTML = "";

    deserializeActions(actionText);

    if(actions.length == 0){
        ActionId = 0;
        actions.push(new TextBlockAction(""));
    }

    ActionId = Math.max(... actions.map(x => x.id)) + 1;
    focusedActionIdx = 0;

    divActions.innerHTML = "";

    function* fnc(){
        for(let act of actions){
            act.init();
            yield* act.restore();
            divActions.appendChild(act.summaryDom());
        }

        yield* waitActions(); 

        for(let act of actions.filter(x => x.constructor.name == "SelectionAction")){
            (act as SelectionAction).setSelectedDoms();
        }
    }

    runGenerator(fnc());
}

}
/*
[
    {
        "typeName": "TextBlockAction",
        "id": 0,
        "text": 😀こんにちは
はじめまして。😀
    },
    {
        "typeName": "View",
        "id": 1,
        "_width": "500px",
        "_height": "500px",
        "_viewBox": "-10 -10 20 20"
    },
    { "typeName": "Point", "id": 2, "pos": { "typeName": "Vec2", "x": -8.399999618530273, "y": -8.319999694824219 } },
    {
        "typeName": "LineSegment",
        "id": 3,
        "handles": [
            {
                "typeName": "Point",
                "id": 4,
                "listeners": [
                    { "ref": 3 }
                ],
                "pos": { "typeName": "Vec2", "x": -8.760000228881836, "y": -6.28000020980835 }
            },
            {
                "typeName": "Point",
                "id": 5,
                "listeners": [
                    { "ref": 3 }
                ],
                "pos": { "typeName": "Vec2", "x": 7.400000095367432, "y": -1.3600000143051147 }
            }
        ],
        "listeners": [
            { "ref": 34 }
        ]
    },
    {
        "typeName": "Rect",
        "id": 6,
        "handles": [
            {
                "typeName": "Point",
                "id": 11,
                "listeners": [
                    { "ref": 6 }
                ],
                "pos": { "typeName": "Vec2", "x": -3.240000009536743, "y": -7.28000020980835 }
            },
            {
                "typeName": "Point",
                "id": 12,
                "listeners": [
                    { "ref": 6 }
                ],
                "pos": { "typeName": "Vec2", "x": 0.5600000023841858, "y": -7.239999771118164 }
            },
            {
                "typeName": "Point",
                "id": 13,
                "listeners": [
                    { "ref": 6 }
                ],
                "pos": { "typeName": "Vec2", "x": 0.5743188008699627, "y": -8.600270713096505 }
            },
            { "typeName": "Point", "id": 14, "pos": { "typeName": "Vec2", "x": -3.2256812110509663, "y": -8.64027115178669 } }
        ],
        "is_square": false,
        "lines": [
            {
                "typeName": "LineSegment",
                "id": 7,
                "handles": [
                    { "ref": 11 },
                    { "ref": 12 }
                ],
                "listeners": [
                    { "ref": 27 }
                ]
            },
            {
                "typeName": "LineSegment",
                "id": 8,
                "handles": [
                    { "ref": 12 },
                    { "ref": 13 }
                ]
            },
            {
                "typeName": "LineSegment",
                "id": 9,
                "handles": [
                    { "ref": 13 },
                    { "ref": 14 }
                ]
            },
            {
                "typeName": "LineSegment",
                "id": 10,
                "handles": [
                    { "ref": 14 },
                    { "ref": 11 }
                ]
            }
        ]
    },
    {
        "typeName": "Circle",
        "id": 15,
        "handles": [
            {
                "typeName": "Point",
                "id": 16,
                "listeners": [
                    { "ref": 15 }
                ],
                "pos": { "typeName": "Vec2", "x": -2.319999933242798, "y": -3.0799999237060547 }
            },
            {
                "typeName": "Point",
                "id": 17,
                "listeners": [
                    { "ref": 15 }
                ],
                "pos": { "typeName": "Vec2", "x": -0.4000000059604645, "y": -0.8399999737739563 }
            }
        ],
        "listeners": [
            { "ref": 20 },
            { "ref": 22 },
            { "ref": 24 }
        ],
        "by_diameter": false
    },
    {
        "typeName": "Triangle",
        "id": 18,
        "handles": [

        ],
        "lines": [
            {
                "typeName": "LineSegment",
                "id": 19,
                "handles": [
                    {
                        "typeName": "Point",
                        "id": 20,
                        "listeners": [
                            { "ref": 19 },
                            { "ref": 23 },
                            { "ref": 27 },
                            { "ref": 29 }
                        ],
                        "pos": { "typeName": "Vec2", "x": -2.6329187497839692, "y": -6.013612255067246 },
                        "bind_to": { "ref": 15 }
                    },
                    {
                        "typeName": "Point",
                        "id": 22,
                        "listeners": [
                            { "ref": 19 },
                            { "ref": 21 },
                            { "ref": 25 }
                        ],
                        "pos": { "typeName": "Vec2", "x": -5.070420278465556, "y": -2.0126726912957262 },
                        "bind_to": { "ref": 15 }
                    }
                ],
                "listeners": [
                    { "ref": 30 },
                    { "ref": 34 }
                ]
            },
            {
                "typeName": "LineSegment",
                "id": 21,
                "handles": [
                    { "ref": 22 },
                    {
                        "typeName": "Point",
                        "id": 24,
                        "listeners": [
                            { "ref": 21 },
                            { "ref": 23 },
                            { "ref": 25 },
                            { "ref": 30 }
                        ],
                        "pos": { "typeName": "Vec2", "x": 0.43042039596777126, "y": -2.0126726500335446 },
                        "bind_to": { "ref": 15 }
                    }
                ],
                "listeners": [
                    { "ref": 36 }
                ]
            },
            {
                "typeName": "LineSegment",
                "id": 23,
                "handles": [
                    { "ref": 24 },
                    { "ref": 20 }
                ],
                "listeners": [
                    { "ref": 36 }
                ]
            }
        ]
    },
    {
        "typeName": "Midpoint",
        "id": 25,
        "handles": [
            { "ref": 22 },
            { "ref": 24 }
        ],
        "midpoint": { "typeName": "Point", "id": 26, "pos": { "typeName": "Vec2", "x": -2.3199999412488923, "y": -2.012672670664635 } }
    },
    {
        "typeName": "Perpendicular",
        "id": 27,
        "handles": [
            { "ref": 20 }
        ],
        "line": { "ref": 7 },
        "foot": { "typeName": "Point", "id": 28, "pos": { "typeName": "Vec2", "x": -2.6196569416855806, "y": -7.27347021118345 } },
        "perpendicular": {
            "typeName": "LineSegment",
            "id": 29,
            "handles": [
                { "ref": 20 },
                { "ref": 28 }
            ]
        }
    },
    {
        "typeName": "ParallelLine",
        "id": 30,
        "handles": [

        ],
        "line1": { "ref": 19 },
        "line2": {
            "typeName": "LineSegment",
            "id": 31,
            "handles": [
                {
                    "typeName": "Point",
                    "id": 32,
                    "listeners": [
                        { "ref": 31 }
                    ],
                    "pos": { "typeName": "Vec2", "x": -9.97520542334334, "y": 15.067226392656547 }
                },
                {
                    "typeName": "Point",
                    "id": 33,
                    "listeners": [
                        { "ref": 31 }
                    ],
                    "pos": { "typeName": "Vec2", "x": 10.836046215278884, "y": -19.092571692723634 }
                }
            ]
        },
        "point": { "ref": 24 }
    },
    {
        "typeName": "Intersection",
        "id": 34,
        "handles": [

        ],
        "lines": [
            { "ref": 3 },
            { "ref": 19 }
        ],
        "intersection": { "typeName": "Point", "id": 35, "pos": { "typeName": "Vec2", "x": -3.4546792377761726, "y": -4.664766311930325 } }
    },
    {
        "typeName": "Angle",
        "id": 36,
        "handles": [

        ],
        "lines": [
            { "ref": 21 },
            { "ref": 23 }
        ],
        "ts": [
0.6527039177074353,
0.3032262570052072
        ]
    },
    {
        "typeName": "TextBox",
        "id": 37,
        "handles": [

        ],
        "text": 😀$$
\frac{1}{2 \pi \sigma^2} \int_{-\infty}^\infty \exp^{ - \frac{{(x - \mu)}^2}{2 \sigma^2}  } dx
$$😀,
        "clicked_pos": { "typeName": "Vec2", "x": 3.1600000858306885, "y": -5.079999923706055 },
        "offset_pos": { "typeName": "Vec2", "x": 329, "y": 123 }
    },
    {
        "typeName": "Label",
        "id": 38,
        "handles": [
            {
                "typeName": "Point",
                "id": 39,
                "listeners": [
                    { "ref": 38 }
                ],
                "pos": { "typeName": "Vec2", "x": 1.6399999856948853, "y": 1.7999999523162842 }
            }
        ],
        "text": "こんにちは"
    }
]



*/