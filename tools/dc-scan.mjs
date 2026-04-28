// Quick feature-grep across the dumped DartCounter chunks.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = 'tools/dartcounter-dump/app.dartcounter.net';
const files = readdirSync(dir).filter((f) => f.endsWith('.js'));

const tests = {
    'score input':    /scoreInput|inputScore|submitScore|registerScore|enterScore|throwDart|recordThrow|saveThrow/i,
    'undo/correct':   /undoLast|undoThrow|correctScore|editScore|undoDart/i,
    'leg/set':        /legWon|setWon|nextLeg|startLeg|finishLeg|matchFinished|legFinished/i,
    'checkout':       /checkoutSuggestion|getCheckout|checkoutHint|finishHint|outshot|finishCombo/i,
    'busting':        /isBust|bustCheck|\bbust\(/i,
    'turn engine':    /nextPlayer|switchPlayer|currentPlayer|activePlayer|nextTurn/i,
    'firebase write': /\.update\(|\.set\(|\.push\(/,
    'voice':          /SpeechRecognition|webkitSpeechRecognition/,
    'cricket':        /closedNumbers|cricketMarks|hitMarks|cricketScore/i,
    'route':          /RouterModule|createRouter|defineRoute|loadChildren|loadComponent/,
    'analytics':      /gtag\(|posthog|mixpanel|amplitude/i,
    'webrtc':         /RTCPeerConnection|getUserMedia/,
    'i18n':           /\bngx-translate|i18next|@nuxtjs\/i18n|vue-i18n/i,
    'state':          /pinia|vuex|@ngrx|redux|zustand/i,
    'framework':      /__VUE__|createApp\(|defineComponent|nuxt|@vue\/runtime/,
    'gameplay route': /\/(play|game|match|live|practice|board)\b/,
};

for (const [name, rx] of Object.entries(tests)) {
    const hits = files.filter((f) => rx.test(readFileSync(join(dir, f), 'utf8')));
    console.log(name.padEnd(16), String(hits.length).padStart(3), hits.slice(0, 4).join(', '));
}
