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

  return new Promise((resolve, reject) => {
    console.log("🔄 Starting audio conversion:", audioFile.name, audioFile.type);

    // Create an audio element from the file
    const audioElement = new Audio();
    const audioUrl = URL.createObjectURL(audioFile);
    audioElement.src = audioUrl;

    // Set up timeout for loading
    const loadTimeout = setTimeout(() => {
      cleanup();
      reject(new Error("Audio file took too long to load"));
    }, 30000); // 30 second timeout

    const cleanup = () => {
      clearTimeout(loadTimeout);
      URL.revokeObjectURL(audioUrl);
    };

    // Wait for the audio to load
    audioElement.addEventListener("loadeddata", () => {
      clearTimeout(loadTimeout);
      console.log("✅ Audio loaded, duration:", audioElement.duration);

      try {
        // Create an AudioContext and MediaStreamDestination
        const audioContext = new AudioContext();
        const mediaStreamDestination =
          audioContext.createMediaStreamDestination();

        // Create a MediaStreamAudioSourceNode from the audio element
        const source = audioContext.createMediaElementSource(audioElement);
        source.connect(mediaStreamDestination);
        source.connect(audioContext.destination); // Also connect to speakers

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
          cleanup();
          audioContext.close();
          reject(new Error("No supported audio encoding format found"));
          return;
        }

        console.log("📹 Using MediaRecorder with:", selectedMimeType);

        const mediaRecorder = new MediaRecorder(mediaStreamDestination.stream, {
          mimeType: selectedMimeType,
          audioBitsPerSecond,
        });

        const chunks: Blob[] = [];

        mediaRecorder.addEventListener("dataavailable", (event) => {
          if (event.data.size > 0) {
            chunks.push(event.data);
            if (onProgress) {
              // Estimate progress based on data received
              const estimatedProgress = Math.min(
                95,
                (chunks.reduce((sum, chunk) => sum + chunk.size, 0) /
                  audioFile.size) *
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
          cleanup();
          if (onProgress) {
            onProgress(100);
          }
          resolve(convertedFile);
        });

        mediaRecorder.addEventListener("error", (event) => {
          console.error("❌ MediaRecorder error:", event);
          cleanup();
          audioContext.close();
          reject(new Error("MediaRecorder error during conversion"));
        });

        // Start recording
        mediaRecorder.start();
        console.log("▶️ Started recording, playing audio...");

        // Play the audio to trigger the recording
        audioElement.currentTime = 0;
        audioElement
          .play()
          .then(() => {
            console.log("🎵 Audio playing, conversion in progress...");
          })
          .catch((playError) => {
            console.error("❌ Failed to play audio:", playError);
            mediaRecorder.stop();
            cleanup();
            audioContext.close();
            reject(new Error("Failed to play audio for conversion"));
          });

        // Stop recording when audio finishes
        audioElement.addEventListener("ended", () => {
          console.log("⏹️ Audio ended, stopping recording...");
          mediaRecorder.stop();
        });

        // Also stop if there's an error playing
        audioElement.addEventListener("error", (error) => {
          console.error("❌ Audio playback error:", error);
          if (mediaRecorder.state !== "inactive") {
            mediaRecorder.stop();
          }
          cleanup();
          audioContext.close();
          reject(new Error("Audio playback failed during conversion"));
        });
      } catch (error) {
        cleanup();
        reject(error);
      }
    });

    audioElement.addEventListener("error", (error) => {
      clearTimeout(loadTimeout);
      console.error("❌ Audio loading error:", error);
      cleanup();
      reject(
        new Error(
          "Failed to load audio file. The file may be corrupted or in an unsupported format."
        )
      );
    });
  });
}

/**
 * Check if a file needs conversion (MP4 container formats)
 */
export function needsConversion(filename: string, mimeType?: string): boolean {
  const ext = filename.split(".").pop()?.toLowerCase();
  const mp4Extensions = ["mp4", "m4v", "m4a"];
  return (
    (ext && mp4Extensions.includes(ext)) ||
    (mimeType && mimeType.includes("mp4"))
  );
}
