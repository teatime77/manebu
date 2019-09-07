/// <reference path="main.ts" />
namespace manebu {

declare var MathJax:any;
export var isPlaying: boolean = false;
var stopPlaying: boolean = false;

export function getCommand(line: string) : [string|null, string|null] {
    var line_trim = line.trim();

    if(line_trim == "$$"){
        return [ "$$", ""];
    }

    for(let cmd of [ "@speak", "@wait", "@select", "@us", "@unselect", "@del", "@img", "@line", "@circle", "@arc" ]){
        if(line.startsWith(cmd + " ") || line_trim == cmd){

            var arg = line.substring(cmd.length + 1).trim();
            return [cmd, arg]
        }
    }

    return [null, null];
}

function parseActionText(action_text: string){
    var lines = action_text.replace('\r\n', '\n').split('\n');

    var texts : string[] = [];

    ActionId = 0;
    for(var line_idx = 0; line_idx < lines.length; ){

        var line = lines[line_idx];

        var [cmd, arg] = getCommand(line);
        if(cmd != null){
            if(texts.length != 0){
                actions.push(new TextBlockAction(texts));
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
                
                actions.push(new TextBlockAction(lines.slice(start_line_idx, line_idx)));
                continue;

            case "@speak":
                actions.push(new SpeechAction(arg));
                break;

            case "@select":
                var dt = JSON.parse(arg) as SelectionAction;
                actions.push(new SelectionAction(dt.block_id, dt.dom_type, dt.start_path, dt.end_path));
                break;

            case "@us":
                actions.push(new UnselectionAction());
                break;

            case "@del":
                actions.push(new EndAction(parseInt(arg)));
                break;

            case "@img":
                actions.push(new ImgAction(arg));
                break;

            case "@line":
            case "@circle":
            case "@arc":
                var data = JSON.parse(arg) as ShapeData;
                actions.push(new ShapeAction(cmd, data));
                break;
            }
        }
        else{
            texts.push(line);
        }

        line_idx++;
    }

    if(texts.length != 0){

        actions.push(new TextBlockAction(texts));
    }
}

function* player(fast_forward: boolean){
    for(let act of actions){
        yield* act.play(fast_forward);
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

function runGenerator(gen: IterableIterator<any>){
    isPlaying = true;
    stopPlaying = false;

    var id = setInterval(function(){
        var ret = gen.next();
        if(ret.done || stopPlaying){        

            isPlaying = false;
            clearInterval(id);
            msg("停止しました。");
        }
    },100);
}

export function playText(action_text: string, ref_node: Node, start_pos: number, fast_forward: boolean){
    parseActionText(action_text);

    var gen = player(fast_forward);
    runGenerator(gen);
}

export function play(){
    playText(textMath.value, null, 0, false);
}

export function stop(){
    stopPlaying = true;
}


}