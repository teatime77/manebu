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
    'エックスエヌに<break/><mark name="1"/>ニューを代入します。',
    '9.52と<break/><mark name="1"/>9.53から',
    'これを<break/><mark name="1"/>zで<break/><mark name="2"/>周辺化します。',
    'ベイズの<break/><mark name="1"/>定理を<break/><mark name="2"/>使うと、',
    '分母を<break/><mark name="1"/>周辺化します。',
    'Jをμkで<break/><mark name="1"/>微分して<break/><mark name="2"/>0とおくと、',
];
speech_texts = [
    'エックスエヌにニューを代入します。',
    '9.52と9.53から',
    'これをzで周辺化します。',
    'ベイズの定理を使うと、',
    '分母を周辺化します。',
    'Jをμkで微分して0とおくと、',
];

var prev_idx = 0;

function speak_next(){
    if(speech_texts.length <= speech_idx){
        return;
    }

    // 発言を作成
    var text = speech_texts[speech_idx];
    speech_idx++;

    var ssml_text = `<?xml version="1.0"?>\r\n<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US">${text}</speak>`;

    ssml_text =     '<?xml version="1.0"?>\r\n<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US">' + text + '</speak>';
    ssml_text = text;


    console.log(ssml_text)

    const uttr = new SpeechSynthesisUtterance(ssml_text);

    // uttr.voice = google_jp;
    // 発言を再生 (発言キューに発言を追加)

    // uttr.onend = speak_next;
    uttr.onend = function(ev: SpeechSynthesisEvent ) { 
        console.log(`end: idx:${ev.charIndex} name:${ev.name} type:${ev.type} text:${ev.utterance.text.substring(prev_idx, ev.charIndex)}`);

        prev_idx = 0;

        speak_next();
    };


    uttr.onmark = function(event) { 
        console.log('A mark was reached: ' + event.name);
    };

    prev_idx = 0;
    uttr.onboundary = function(ev: SpeechSynthesisEvent ) { 
        console.log(`bdr: idx:${ev.charIndex} name:${ev.name} type:${ev.type} text:${ev.utterance.text.substring(prev_idx, ev.charIndex)}`);
        prev_idx = ev.charIndex;
    };

    // uttr.addEventListener('mark', function(event) { 
    //     console.log('A mark was reached: ' + event.name);
    // });

    speechSynthesis.speak(uttr);
}

export function addSpeech(text: string){
    if(text == ""){
        return;
    }
    textMath.value = "";

    var act = new SpeechAction(text);
    actions.push(act);
    addActionSummary(act);
}

export function* speak(act: SpeechAction){
    const uttr = new SpeechSynthesisUtterance(act.text);

    // uttr.voice = google_jp;
    // 発言を再生 (発言キューに発言を追加)

    var ended = false;
    uttr.onend = function(ev: SpeechSynthesisEvent ) {
        ended = true;
        console.log(`end: idx:${ev.charIndex} name:${ev.name} type:${ev.type} text:${ev.utterance.text.substring(prev_idx, ev.charIndex)}`);
    };

    uttr.onboundary = function(ev: SpeechSynthesisEvent ) { 
        console.log(`bdr: idx:${ev.charIndex} name:${ev.name} type:${ev.type} text:${ev.utterance.text.substring(prev_idx, ev.charIndex)}`);
        prev_idx = ev.charIndex;
    };

    speechSynthesis.speak(uttr);

    while(! ended){
        yield;
    }
}

}