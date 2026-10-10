const textInput = document.getElementById("text");
const speakBtn = document.getElementById("speakBtn");
const voiceSelect = document.getElementById("voice");
const statusText = document.getElementById("status");
const audio = document.getElementById("audio");

speakBtn.addEventListener("click", async () => {
  const text = textInput.value.trim();

  if (!text) {
    statusText.textContent = "Please enter some Luganda text.";
    return;
  }

  speakBtn.disabled = true;
  statusText.textContent = "Generating Luganda voice...";
  audio.removeAttribute("src");

  try {
    const response = await fetch("/api/tts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ text, voice: voiceSelect.value })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Voice generation failed.");
    }

    audio.src = data.audio_url;
    audio.load();

    statusText.textContent = "Voice generated successfully! ▶️";
  } catch (error) {
    console.error(error);
    statusText.textContent = error.message;
  } finally {
    speakBtn.disabled = false;
  }
});


// Speech-to-Text recording
const recordBtn = document.getElementById("recordBtn");
const recordStatus = document.getElementById("recordStatus");
const transcript = document.getElementById("transcript");

let mediaRecorder;
let audioChunks = [];

recordBtn.addEventListener("click", async () => {
  if (!mediaRecorder || mediaRecorder.state === "inactive") {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true
      });

      audioChunks = [];

      mediaRecorder = new MediaRecorder(stream);

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());

        const blob = new Blob(audioChunks, {
          type: mediaRecorder.mimeType || "audio/webm"
        });

        const formData = new FormData();

        formData.append(
          "audio",
          blob,
          "luganda-recording.webm"
        );

        recordBtn.disabled = true;
        recordStatus.textContent = "Transcribing Luganda...";

        try {
          const response = await fetch("/api/stt", {
            method: "POST",
            body: formData
          });

          const responseText = await response.text();

          let data = {};

          try {
            data = responseText ? JSON.parse(responseText) : {};
          } catch (parseError) {
            console.error("Server returned:", responseText);
            throw new Error(
              "The server returned an unexpected response."
            );
          }

          if (!response.ok) {
            throw new Error(
              data.error || "Transcription failed. Server gave no error details."
            );
          }

          transcript.value = data.text || "";

          recordStatus.textContent =
            "Transcription complete. ✅";

        } catch (error) {
          console.error(error);
          recordStatus.textContent = error.message;

        } finally {
          recordBtn.disabled = false;
        }
      };

      mediaRecorder.start();

      recordBtn.textContent = "Stop Recording";
      recordStatus.textContent =
        "Listening... Speak Luganda.";

    } catch (error) {
      console.error(error);

      recordStatus.textContent =
        "Microphone permission is required.";
    }

  } else {
    mediaRecorder.stop();

    recordBtn.textContent = "Start Recording";
    recordStatus.textContent =
      "Processing recording...";
  }
});


// Audio file transcription
const audioFileInput = document.getElementById("audioFile");
const transcribeBtn = document.getElementById("transcribeBtn");
const uploadStatus = document.getElementById("uploadStatus");
const uploadTranscript = document.getElementById("uploadTranscript");

transcribeBtn.addEventListener("click", async () => {
  const file = audioFileInput.files[0];

  if (!file) {
    uploadStatus.textContent = "Please choose an audio file first.";
    return;
  }

  const formData = new FormData();
  formData.append("audio", file);

  transcribeBtn.disabled = true;
  uploadStatus.textContent = "Transcribing your audio...";
  uploadTranscript.value = "";

  try {
    const response = await fetch("/api/stt", {
      method: "POST",
      body: formData
    });

    const responseText = await response.text();
    let data = {};

    try {
      data = responseText ? JSON.parse(responseText) : {};
    } catch {
      throw new Error("The server returned an unexpected response.");
    }

    if (!response.ok) {
      throw new Error(data.error || "Audio transcription failed.");
    }

    uploadTranscript.value = data.text || "";
    uploadStatus.textContent = "Audio transcription complete. ✅";

  } catch (error) {
    console.error(error);
    uploadStatus.textContent = error.message;

  } finally {
    transcribeBtn.disabled = false;
  }
});

/* Tool screen navigation */
const toolScreens = document.querySelectorAll(".tool-screen");
const hero = document.querySelector(".hero");
const quickNav = document.querySelector(".quick-nav");
const mainContainer = document.querySelector(".container");

const homeBtn = document.createElement("button");
homeBtn.id = "homeBtn";
homeBtn.type = "button";
homeBtn.textContent = "← Home / All tools";
homeBtn.hidden = true;
mainContainer.insertBefore(homeBtn, toolScreens[0]);

function showHome() {
  hero.hidden = false;
  quickNav.hidden = false;
  toolScreens.forEach(screen => screen.hidden = false);
  homeBtn.hidden = true;
  history.replaceState(null, "", location.pathname);
  window.scrollTo(0, 0);
}

function showTool(id) {
  hero.hidden = true;
  quickNav.hidden = true;
  toolScreens.forEach(screen => screen.hidden = screen.id !== id);
  homeBtn.hidden = false;
  history.replaceState(null, "", "#" + id);
  window.scrollTo(0, 0);
}

quickNav.querySelectorAll("a").forEach(link => {
  link.addEventListener("click", event => {
    event.preventDefault();
    showTool(link.getAttribute("href").slice(1));
  });
});

homeBtn.addEventListener("click", showHome);
