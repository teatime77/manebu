/// <reference path="main.ts" />
namespace manebu {

declare var MathJax:any;
export var isPlaying: boolean = false;
var line_idx : number;

function getCommand(line: string) : [string|null, string|null] {
    var line_trim = line.trim();

    if(line_trim == "$$"){
        return [ "$$", ""];
    }

    for(let cmd of [ "@speak", "@wait", "@select", "@us", "@unselect", "@img" ]){
        if(line.startsWith(cmd + " ") || line_trim == cmd){

            var arg = line.substring(cmd.length + 1).trim();
            return [cmd, arg]
        }
    }

    return [null, null];
}

export function makeBlockDiv(block_text: string, ref_node: Node) : HTMLDivElement{
    var div = document.createElement("div");
    div.className = "manebu-text-block";
    div.dataset.block_text = block_text;

    divMath.insertBefore(div, ref_node);

    return div;
}

function* player(lines: string[], ref_node: Node, start_pos: number, fast_forward: boolean){
    var texts : string[] = [];

    for(line_idx = start_pos; line_idx < lines.length; ){

        var line = lines[line_idx];

        var [cmd, arg] = getCommand(line);
        if(cmd != null){
            if(texts.length != 0){

                yield* appendTextBlock( texts, ref_node, fast_forward );
                texts = [];
            }

            switch(cmd){
            case "$$":
                var start_line_idx = line_idx;
                for(line_idx++; line_idx < lines.length; line_idx++){
                    if(lines[line_idx].trim() == "$$"){
                        line_idx++;
                        break;
                    }
                }
                
                yield* appendTextBlock( lines.slice(start_line_idx, line_idx), ref_node, fast_forward );
                continue;

            case "@speak":
                if(arg != ""){

                    if(! fast_forward){

                        yield* speak(arg);
                    }

                    var div = makeBlockDiv(line, ref_node);
                    div.innerHTML = arg;
                }
                break;

            case "@select":
                if(! fast_forward){
                    
                    var act = JSON.parse(arg) as SelectionAction;

                    setSelection(act);

                }

                makeBlockDiv(line, ref_node);
                break;

            case "@us":
                if(! fast_forward){
                
                    restore_current_mjx_color();
                }

                makeBlockDiv(line, ref_node);
                break;

            case "@img":
                addSVG(arg);
                break;
            }
        }
        else{
            texts.push(line);
        }

        line_idx++;
    }

    if(texts.length != 0){

        yield* appendTextBlock( texts, ref_node, fast_forward );
    }

    if(fast_forward){

        var typeset_done = false;
        MathJax.Hub.Queue(["Typeset",MathJax.Hub]);
        MathJax.Hub.Queue([function(){
            typeset_done = true;
        }]);

        while(! typeset_done){
            yield;
        }
    }
}

export function playText(text: string, ref_node: Node, start_pos: number, fast_forward: boolean){
    isPlaying = true;
    var lines = text.replace('\r\n', '\n').split('\n');

    var gen = player(lines, ref_node, start_pos, fast_forward);
    var id = setInterval(function(){
        var ret = gen.next();
        if(ret.done){        

            isPlaying = false;
            clearInterval(id);
        }
    },100);
}

export function preview(start_pos: number, fast_forward: boolean){
    if(start_pos == 0){
        divMath.innerHTML = "";
    }

    playText(textMath.value, null, start_pos, fast_forward);
}
}