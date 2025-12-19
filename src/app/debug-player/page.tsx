"use client";

import { ChorusingPlayer } from "@/components/chorus/ChorusingPlayer";
import type { AudioClip } from "@/types/audio";

// Debug page to test ChorusingPlayer in isolation
export default function DebugPlayerPage() {
  // Use a test clip - you'll need to replace this with an actual clip from your database
  const testClip: AudioClip & {
    url: string;
    starCount: number;
    isStarredByUser: boolean;
  } = {
    id: "test-clip",
    title: "Test Clip",
    duration: 10,
    filename: "test.mp3",
    originalFilename: "test.mp3",
    fileSize: 1000000,
    metadata: {
      language: "en",
      speakerGender: "male" as const,
      speakerAgeRange: "adult" as const,
      speakerDialect: "",
      transcript: "Test transcript",
      sourceUrl: "",
      tags: [],
    },
    uploadedBy: "test-user",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    url: "/audio/sample.mp3", // Use the sample audio file
    starCount: 0,
    isStarredByUser: false,
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">Debug Player Page</h1>
        <p className="text-gray-600 mb-6">
          This page tests ChorusingPlayer in isolation to verify controls work.
        </p>
        <ChorusingPlayer clip={testClip} />
      </div>
    </div>
  );
}
