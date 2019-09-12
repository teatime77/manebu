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

    for(let cmd of [ "@speak", "@wait", "@select", "@us", "@unselect", "@del", "@line", "@circle", "@arc" ]){
        if(line.startsWith(cmd + " ") || line_trim == cmd){

            var arg = line.substring(cmd.length + 1).trim();
            return [cmd, arg]
        }
    }

    return [null, null];
}

export function parseActionText(action_text: string){
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

            case "@line":
            case "@circle":
            case "@arc":
                var data = JSON.parse(arg);
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

    for(let act of actions){
        divActions.appendChild(act.summaryDom());
    }
}

function* waitActions(){
    var typeset_done = false;
    MathJax.Hub.Queue(["Typeset",MathJax.Hub]);
    MathJax.Hub.Queue([function(){
        typeset_done = true;
    }]);

    while(! typeset_done){
        yield;
    }

    divMath.scrollTop = divMath.scrollHeight;
}

export function runGenerator(gen: IterableIterator<any>){
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

export function openActionData(action_text: string){
    parseActionText(action_text);

    for(let act of actions){
        act.init();
    }

    function* fnc(){
        yield* waitActions(); 

        for(let act of actions.filter(x => x.constructor.name == "SelectionAction")){
            (act as SelectionAction).setSelectedDoms();
        }
    }

    runGenerator(fnc());
}

export function playActions(){
    function* fnc(){
        for(let act of actions){
            yield* act.play();
        }        
    }

    runGenerator(fnc());
}

export function stop(){
    stopPlaying = true;
}


}