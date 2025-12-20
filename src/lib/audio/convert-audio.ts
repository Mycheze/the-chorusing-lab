/**
 * Client-side audio conversion utility
 * Converts audio files to browser-compatible formats (MP3/WebM)
 * using Web Audio API and MediaRecorder
 */

export interface ConversionOptions {
  onProgress?: (progress: number) => void;
  audioBitsPerSecond?: number;
}

/**
 * Converts an audio file to a browser-compatible format (MP3 or WebM)
 * This is useful for converting MP4/M4A files that have metadata parsing issues
 *
 * @param audioFile - The audio file to convert
 * @param options - Optional conversion settings
 * @returns Promise resolving to the converted File
 */
export async function convertAudioToCompatibleFormat(
  audioFile: File,
  options: ConversionOptions = {}
): Promise<File> {
  const { onProgress, audioBitsPerSecond = 128000 } = options;

  console.log(
    "🔄 Starting audio conversion:",
    audioFile.name,
    audioFile.type
  );

  try {
    // Read file as ArrayBuffer
    const arrayBuffer = await audioFile.arrayBuffer();
    console.log("📦 Read file as ArrayBuffer:", arrayBuffer.byteLength, "bytes");

    // Create AudioContext
    const audioContext = new AudioContext();
    let audioBuffer: AudioBuffer;

    try {
      // Try to decode audio data directly - this works even with MP4 metadata issues
      audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
      console.log(
        "✅ Audio decoded successfully, duration:",
        audioBuffer.duration,
        "seconds"
      );
    } catch (decodeError) {
      console.error("❌ AudioContext.decodeAudioData failed:", decodeError);
      audioContext.close();
      throw new Error(
        "Failed to decode audio file. The file may be corrupted or in an unsupported format."
      );
    }

    // Create a MediaStreamDestination for recording
    const mediaStreamDestination = audioContext.createMediaStreamDestination();

    // Create a buffer source from the decoded audio
    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(mediaStreamDestination);
    source.connect(audioContext.destination);

    // Set up MediaRecorder to record as MP3 (or webm if MP3 not supported)
    const mimeTypes = [
      "audio/mpeg",
      "audio/webm;codecs=opus",
      "audio/webm",
    ];
    let selectedMimeType = "";

    for (const mimeType of mimeTypes) {
      if (MediaRecorder.isTypeSupported(mimeType)) {
        selectedMimeType = mimeType;
        break;
      }
    }

    if (!selectedMimeType) {
      audioContext.close();
      throw new Error("No supported audio encoding format found");
    }

    console.log("📹 Using MediaRecorder with:", selectedMimeType);

    const mediaRecorder = new MediaRecorder(mediaStreamDestination.stream, {
      mimeType: selectedMimeType,
      audioBitsPerSecond,
    });

    const chunks: Blob[] = [];

    return new Promise((resolve, reject) => {
      mediaRecorder.addEventListener("dataavailable", (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
          if (onProgress) {
            // Estimate progress based on playback time
            const estimatedProgress = Math.min(
              95,
              (chunks.reduce((sum, chunk) => sum + chunk.size, 0) /
                (audioFile.size * 0.5)) * // Rough estimate
                100
            );
            onProgress(estimatedProgress);
          }
        }
      });

      mediaRecorder.addEventListener("stop", () => {
        const finalBlob = new Blob(chunks, { type: selectedMimeType });

        // Determine file extension based on MIME type
        let extension = "webm";
        if (selectedMimeType.includes("mpeg")) {
          extension = "mp3";
        } else if (selectedMimeType.includes("opus")) {
          extension = "webm";
        }

        // Create new filename with correct extension
        const originalName = audioFile.name.replace(/\.[^/.]+$/, "");
        const newFilename = `${originalName}.${extension}`;

        const convertedFile = new File([finalBlob], newFilename, {
          type: selectedMimeType,
        });

        console.log(
          `✅ Conversion complete: ${audioFile.size} bytes → ${finalBlob.size} bytes`
        );
        console.log(
          `📊 Size change: ${(
            ((audioFile.size - finalBlob.size) / audioFile.size) *
            100
          ).toFixed(1)}%`
        );

        // Cleanup
        audioContext.close();
        if (onProgress) {
          onProgress(100);
        }
        resolve(convertedFile);
      });

      mediaRecorder.addEventListener("error", (event) => {
        console.error("❌ MediaRecorder error:", event);
        audioContext.close();
        reject(new Error("MediaRecorder error during conversion"));
      });

      // Start recording
      mediaRecorder.start();
      console.log("▶️ Started recording, playing audio buffer...");

      // Play the audio buffer
      source.start(0);

      // Stop recording when audio finishes
      const durationMs = audioBuffer.duration * 1000;
      setTimeout(() => {
        if (mediaRecorder.state !== "inactive") {
          console.log("⏹️ Stopping recording...");
          mediaRecorder.stop();
        }
        source.stop();
      }, durationMs + 100); // Add 100ms buffer
    });
  } catch (error) {
    console.error("❌ Conversion failed:", error);
    throw error instanceof Error
      ? error
      : new Error("Audio conversion failed");
  }
}

/**
 * Check if a file needs conversion (MP4 container formats)
 */
export function needsConversion(filename: string, mimeType?: string): boolean {
  const ext = filename.split(".").pop()?.toLowerCase();
  const mp4Extensions = ["mp4", "m4v", "m4a"];
  return (
    Boolean(ext && mp4Extensions.includes(ext)) ||
    Boolean(mimeType && mimeType.includes("mp4"))
  );
}
