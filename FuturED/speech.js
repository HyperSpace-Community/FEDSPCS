let recognition = null;
let isListening = false;

function initializeSpeechRecognition() {
    if ('webkitSpeechRecognition' in window) {
        recognition = new webkitSpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onstart = () => {
            isListening = true;
            updateMicrophoneButton(true);
        };

        recognition.onend = () => {
            isListening = false;
            updateMicrophoneButton(false);
        };

        recognition.onresult = (event) => {
            const editor = document.getElementById('editor');
            let finalTranscript = '';
            let interimTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    finalTranscript += transcript;
                } else {
                    interimTranscript += transcript;
                }
            }

            // Insert the transcribed text at cursor position
            if (finalTranscript) {
                insertTextAtCursor(finalTranscript);
            }
        };

        recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            isListening = false;
            updateMicrophoneButton(false);
        };
    } else {
        console.error('Speech recognition not supported in this browser');
    }
}

function toggleSpeechInput() {
    if (!recognition) {
        initializeSpeechRecognition();
    }

    if (!recognition) {
        alert('Speech recognition is not supported in your browser');
        return;
    }

    if (isListening) {
        recognition.stop();
    } else {
        recognition.start();
    }
}

function updateMicrophoneButton(isActive) {
    const micButton = document.getElementById('micButton');
    const micIcon = micButton.querySelector('i');

    if (isActive) {
        micIcon.classList.remove('fa-microphone');
        micIcon.classList.add('fa-microphone-slash');
        micButton.classList.add('active');
    } else {
        micIcon.classList.add('fa-microphone');
        micIcon.classList.remove('fa-microphone-slash');
        micButton.classList.remove('active');
    }
}

function insertTextAtCursor(text) {
    const selection = window.getSelection();
    const range = selection.getRangeAt(0);
    const textNode = document.createTextNode(text + ' ');
    range.insertNode(textNode);
    range.setStartAfter(textNode);
    range.setEndAfter(textNode);
    selection.removeAllRanges();
    selection.addRange(range);
}