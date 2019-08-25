/// <reference path="main.ts" />
namespace manebu {

var lines : string[];
var line_idx : number;

function getCommand(line: string) : [string|null, string|null] {
    for(let cmd of ["@speak", "@wait", "@del", "@select", "@unselect" ]){
        if(line.startsWith(cmd + " ")){

            var arg = line.substring(cmd.length + 1);
            return [cmd, arg]
        }
    }

    return [null, null];
}

function* player(start_pos: number){
    var texts : string[] = [];
    var valid_text : boolean = false;

    for(line_idx = start_pos; line_idx < lines.length; line_idx++){
        var line = lines[line_idx];

        var [cmd, arg] = getCommand(line);
        if(cmd != null){
            if(valid_text){

                yield* makeTextBlock( new TextBlockAction(texts.join('\n')) );
                texts = [];
                valid_text = false;
            }

            switch(cmd){
            case "@speak":
                if(arg.trim() != ""){

                    yield* speak(new SpeechAction(arg));
                }
                break;

            case "@select":
                var act = JSON.parse(arg) as SelectionAction;

                setSelection(act);
                break;

            case "@del":
                var id = getTextBlockId( parseInt(arg) );

                removeTextBlock(new RemoveAction(id));
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

        yield* makeTextBlock( new TextBlockAction(texts.join('\n')) );
    }

}

export function preview(start_pos: number){
    lines = textMath.value.replace('\r\n', '\n').split('\n');

    var gen = player(start_pos);
    var id = setInterval(function(){
        var ret = gen.next();
        if(ret.done){
            clearInterval(id);
        }
    },100);
}

export function open_markdown(this_url : string){
    var k = this_url.lastIndexOf('/');
    var data_url = this_url.substring(0, k) + "/data/test.md";

    fetch(data_url)
    .then(function(response) {
        return response.text();
    })
    .then(function (text) {
        textMath.value = text;
    });

}
}