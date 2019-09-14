/// <reference path="main.ts" />
namespace manebu {

declare var MathJax:any;
export var isPlaying: boolean = false;
var stopPlaying: boolean = false;

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
    deserializeActions(action_text);

    if(actions.length == 0){
        ActionId = 0;
        actions.push(new TextBlockAction(""));
    }

    ActionId = Math.max(... actions.map(x => x.action_id)) + 1;
    focusedActionIdx = 0;

    divMath.innerHTML = "";
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