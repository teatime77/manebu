/// <reference path="main.ts" />
namespace manebu {
export var is_speaking = false;
var voice_list = null;
var jp_voice : SpeechSynthesisVoice = null;
var prev_idx = 0;

function setVoice(){
    const voices = speechSynthesis.getVoices()
    voice_list = [];
    voices.forEach(voice => { //　アロー関数 (ES6)
        msg(`${voice.lang} [${voice.name}] ${voice.default} ${voice.localService} ${voice.voiceURI}`);

        if(voice.name == "Microsoft Haruka Desktop - Japanese"){
            msg("set Haruka voice");
            jp_voice = voice;
        }
        if(jp_voice == null && (voice.lang == "ja-JP" || voice.lang == "ja_JP")){
            msg(`set jp voice[${voice.name}]`);
            jp_voice = voice;
        }
        voice_list.push(voice.name);
    });
}

export function init_speech(){
    if ('speechSynthesis' in window) {
        msg("このブラウザは音声合成に対応しています。🎉");
    }
    else {
        msg("このブラウザは音声合成に対応していません。😭");
    }    

    speechSynthesis.onvoiceschanged = function(){
        msg("voices changed");
        setVoice();
    };
}

export function* speak(text: string){
    if(voice_list == null){
        setVoice();
    }

    while(is_speaking){
        yield;
    }

    const uttr = new SpeechSynthesisUtterance(text);

    if(jp_voice != null){
        uttr.voice = jp_voice;
    }

    is_speaking = true;
    uttr.onend = function(ev: SpeechSynthesisEvent ) {
        is_speaking = false;
        msg(`end: idx:${ev.charIndex} name:${ev.name} type:${ev.type} text:${ev.utterance.text.substring(prev_idx, ev.charIndex)}`);
    };

    uttr.onboundary = function(ev: SpeechSynthesisEvent ) { 
        msg(`bdr: idx:${ev.charIndex} name:${ev.name} type:${ev.type} text:${ev.utterance.text.substring(prev_idx, ev.charIndex)}`);
        prev_idx = ev.charIndex;
    };

    speechSynthesis.speak(uttr);
}

}