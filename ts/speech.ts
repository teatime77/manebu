/// <reference path="main.ts" />
namespace manebu {
var google_jp = undefined;

export function init_speech(){
    if ('speechSynthesis' in window) {
        console.log("このブラウザは音声合成に対応しています。🎉");
    }
    else {
        console.log("このブラウザは音声合成に対応していません。😭");
    }    

    speechSynthesis.onvoiceschanged = function(){
        console.log("voices changed");
        const voices = speechSynthesis.getVoices()
        voices.forEach(voice => { //　アロー関数 (ES6)
            console.log(`${voice.lang} [${voice.name}] ${voice.default} ${voice.localService} ${voice.voiceURI}`);

            if(voice.name == "Google 日本語"){
                google_jp = voice;
            }
        });
    };

}

var speech_idx = 0;
var speech_texts = [
    "エックスエヌにニューを代入します。",
    "9.52と9.53から",
    "これをzで周辺化します。",
    "ベイズの定理を使うと、",
    "分母を周辺化します。",
    "Jをμkで微分して0とおくと、",
];

function speak_next(){
    if(speech_texts.length <= speech_idx){
        return;
    }

    // 発言を作成
    var text = speech_texts[speech_idx];
    speech_idx++;

    console.log(text)
    const uttr = new SpeechSynthesisUtterance(text);

    // uttr.voice = google_jp;
    // 発言を再生 (発言キューに発言を追加)

    uttr.onend = speak_next;

    speechSynthesis.speak(uttr);
}

export function speak(){
    speak_next();
}

}