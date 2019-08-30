/// <reference path="main.ts" />
namespace manebu {

var lines : string[];
var line_idx : number;

function getCommand(line: string) : [string|null, string|null] {
    var line_trim = line.trim();

    for(let cmd of [ "@div", "@speak", "@wait", "@del", "@select", "@us", "@unselect", "@img" ]){
        if(line.startsWith(cmd + " ") || line_trim == cmd){

            var arg = line.substring(cmd.length + 1).trim();
            return [cmd, arg]
        }
    }

    return [null, null];
}

function* player(start_pos: number){
    var texts : string[] = [];
    var valid_text : boolean = false;

    divMath.appendChild(document.createElement("div"));
    for(line_idx = start_pos; line_idx < lines.length; line_idx++){

        var line = lines[line_idx];

        var [cmd, arg] = getCommand(line);
        if(cmd != null){
            if(valid_text){

                yield* appendTextBlock( texts );
                texts = [];
                valid_text = false;
            }

            switch(cmd){
            case "@div":
                divMath.appendChild(document.createElement("div"));
                break;

            case "@speak":
                if(arg != ""){

                    yield* speak(new SpeechAction(arg));

                    valid_text = true;
                    texts.push(arg);
                }
                break;

            case "@select":
                var act = JSON.parse(arg) as SelectionAction;

                setSelection(act);
                break;

            case "@us":
                restore_current_mjx_color();
                break;

            case "@del":
                if(arg == ""){
                    divMath.innerHTML = "";
                }
                else{
                    var idx = parseInt(arg) - 1;

                    console.assert(0 <= idx && idx < divMath.childNodes.length );
                    divMath.removeChild(divMath.childNodes[idx]);
                }

            case "@img":
                var img = document.createElement("img");
                divMath.appendChild(img);
                setImgSrc(img, arg);

                divMath.appendChild(document.createElement("div"));
                break;
            }
        }
        else{
            if(! valid_text && line.trim() != ""){
                valid_text = true;
            }
            texts.push(line);
        }
    }

    if(valid_text){

        yield* appendTextBlock( texts );
    }

}

export function playText(text: string, start_pos: number){
    lines = text.replace('\r\n', '\n').split('\n');

    var gen = player(start_pos);
    var id = setInterval(function(){
        var ret = gen.next();
        if(ret.done){
            clearInterval(id);
        }
    },100);
}

export function preview(start_pos: number){
    if(start_pos == 0){
        divMath.innerHTML = "";
    }

    playText(textMath.value, start_pos);
}

}