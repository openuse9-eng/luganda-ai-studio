const express = require("express");
const cors = require("cors");
const path = require("path");
const multer = require("multer");
const { spawn } = require("child_process");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });

app.use(express.static(path.join(__dirname, "../frontend")));

app.get("/api/status", (req, res) => {
  res.json({
    message: "Luganda AI Studio is running!",
    status: "ok"
  });
});

app.post("/api/tts", async (req, res) => {
  try {
    const { text, voice } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({
        error: "Please enter some Luganda text."
      });
    }

    if (!process.env.SUNBIRD_API_KEY) {
      return res.status(500).json({
        error: "Sunbird API key is not available."
      });
    }

    const response = await fetch(
      "https://api.sunbird.ai/tasks/audio/speech",
      {
        method: "POST",
        headers: {
          "accept": "application/json",
          "Authorization": `Bearer ${process.env.SUNBIRD_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          text: text.trim(),
          voice: voice || "salt_lug_0001",
          language: "lug",
          response_mode: "url"
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Sunbird error:", data);

      return res.status(response.status).json({
        error: "Sunbird could not generate the voice."
      });
    }

    res.json({
      audio_url: data.audio_url
    });

  } catch (error) {
    console.error("TTS error:", error);

    res.status(500).json({
      error: "Something went wrong while generating the voice."
    });
  }
});


app.post("/api/stt", upload.single("audio"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: "Please record some audio."
      });
    }

    if (!process.env.SUNBIRD_API_KEY) {
      return res.status(500).json({
        error: "Sunbird API key is not available."
      });
    }

    const wavBuffer = await new Promise((resolve, reject) => {
      const ffmpeg = spawn("ffmpeg", [
        "-i", "pipe:0",
        "-ar", "16000",
        "-ac", "1",
        "-f", "wav",
        "pipe:1"
      ]);

      const output = [];
      const errors = [];

      ffmpeg.stdout.on("data", (chunk) => {
        output.push(chunk);
      });

      ffmpeg.stderr.on("data", (chunk) => {
        errors.push(chunk);
      });

      ffmpeg.on("error", reject);

      ffmpeg.on("close", (code) => {
        if (code !== 0) {
          reject(
            new Error(
              Buffer.concat(errors).toString() ||
              `FFmpeg exited with code ${code}`
            )
          );
          return;
        }

        resolve(Buffer.concat(output));
      });

      ffmpeg.stdin.write(req.file.buffer);
      ffmpeg.stdin.end();
    });

    const form = new FormData();

    form.append(
      "audio",
      new Blob([wavBuffer], { type: "audio/wav" }),
      "luganda-recording.wav"
    );

    form.append("language", "lug");

    const response = await fetch(
      "https://api.sunbird.ai/tasks/audio/transcriptions",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.SUNBIRD_API_KEY}`,
          "accept": "application/json"
        },
        body: form
      }
    );

    const responseText = await response.text();

    let data = {};

    try {
      data = responseText ? JSON.parse(responseText) : {};
    } catch (parseError) {
      console.error("Sunbird returned non-JSON:", responseText);

      return res.status(502).json({
        error: "Sunbird returned an unexpected response."
      });
    }

    if (!response.ok) {
      console.error("Sunbird STT error:", data);

      return res.status(response.status).json({
        error: `Sunbird error (${response.status}): ${data.detail || data.message || data.error || JSON.stringify(data)}`
      });
    }

    res.json({
      text: data.audio_transcription || ""
    });

  } catch (error) {
    console.error("STT error:", error);

    res.status(500).json({
      error: `Transcription server error: ${error.message}`
    });
  }
});

app.listen(PORT, () => {
  console.log(`Luganda AI Studio server running on port ${PORT}`);
});
