"use client";

import {
  Play,
  ChevronRight,
  ChevronDown,
  Clock,
  User,
  Tag,
  Star,
  Edit,
  Trash2,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { AudioPlayer } from "@/components/audio/AudioPlayer";
import type { ClipWithStarInfo } from "@/components/browse/AudioBrowser";

interface ClipCardProps {
  clip: ClipWithStarInfo;
  isExpanded: boolean;
  isPlaying: boolean;
  user: { id: string; isAdmin?: boolean } | null;
  onToggleExpanded: (clipId: string) => void;
  onPlay: (clipId: string) => void;
  onStar: (clipId: string, isStarred: boolean) => void;
  onEdit: (clip: ClipWithStarInfo) => void;
  onDelete: (clip: ClipWithStarInfo) => void;
}

function formatDuration(seconds: number) {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}m ${secs}s`;
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString();
}

export function ClipCard({
  clip,
  isExpanded,
  isPlaying,
  user,
  onToggleExpanded,
  onPlay,
  onStar,
  onEdit,
  onDelete,
}: ClipCardProps) {
  return (
    <div className="hover:bg-gray-50">
      {/* Clip Header - Now fully clickable */}
      <div
        className="p-4 cursor-pointer"
        onClick={() => onToggleExpanded(clip.id)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 flex-1">
            <div className="text-gray-400 hover:text-gray-600">
              {isExpanded ? (
                <ChevronDown className="w-5 h-5" />
              ) : (
                <ChevronRight className="w-5 h-5" />
              )}
            </div>

            <div className="flex-1">
              <h3 className="font-medium text-gray-900">
                {clip.title}
              </h3>
              <div className="flex items-center gap-4 text-sm text-gray-500 mt-1 flex-wrap">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatDuration(clip.duration)}
                </span>
                <span>{clip.metadata.language}</span>
                {clip.metadata.speakerGender && (
                  <span className="flex items-center gap-1">
                    <User className="w-3 h-3" />
                    {clip.metadata.speakerGender}
                  </span>
                )}
                <span>{formatDate(clip.createdAt)}</span>
                {clip.starCount > 0 && (
                  <span className="flex items-center gap-1 text-yellow-600">
                    <Star className="w-3 h-3 fill-current" />
                    {clip.starCount}
                  </span>
                )}
                {clip.difficultyRating && (
                  <span className="flex items-center gap-1 text-blue-600">
                    <Star className="w-3 h-3 fill-current" />
                    {clip.difficultyRating.toFixed(1)}
                    {(clip.difficultyRatingCount ?? 0) > 0 && (
                      <span className="text-xs">
                        ({clip.difficultyRatingCount})
                      </span>
                    )}
                  </span>
                )}
                {(clip.voteScore !== undefined && clip.voteScore !== 0) || (clip.upvoteCount ?? 0) > 0 || (clip.downvoteCount ?? 0) > 0 ? (
                  <span className={`flex items-center gap-1 ${
                    (clip.voteScore ?? 0) > 0 ? "text-green-600" :
                    (clip.voteScore ?? 0) < 0 ? "text-red-600" :
                    "text-gray-500"
                  }`}>
                    {(clip.voteScore ?? 0) > 0 ? "+" : ""}{clip.voteScore ?? 0}
                    <span className="text-xs text-gray-500">
                      ({clip.upvoteCount ?? 0}/{clip.downvoteCount ?? 0})
                    </span>
                  </span>
                ) : null}
                {clip.charactersPerSecond && (
                  <span className="flex items-center gap-1 text-purple-600">
                    {clip.charactersPerSecond.toFixed(1)} chars/s
                    {clip.speedCategory && (
                      <span className={`ml-1 px-1.5 py-0.5 rounded text-xs ${
                        clip.speedCategory === "slow" ? "bg-blue-100 text-blue-700" :
                        clip.speedCategory === "medium" ? "bg-yellow-100 text-yellow-700" :
                        "bg-orange-100 text-orange-700"
                      }`}>
                        {clip.speedCategory}
                      </span>
                    )}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div
            className="flex items-center gap-2"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Chorus Now Button */}
            <Link
              href={`/chorus/${clip.id}`}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 text-sm font-medium"
            >
              <Zap className="w-4 h-4" />
              Chorus Now!
            </Link>

            {user && (
              <>
                <button
                  onClick={() =>
                    onStar(clip.id, clip.isStarredByUser)
                  }
                  className={`p-2 rounded-md hover:bg-gray-100 ${
                    clip.isStarredByUser
                      ? "text-yellow-500"
                      : "text-gray-400"
                  }`}
                >
                  <Star
                    className={`w-4 h-4 ${
                      clip.isStarredByUser ? "fill-current" : ""
                    }`}
                  />
                </button>
                {/* Only show edit button for clips uploaded by current user or admins */}
                {(clip.uploadedBy === user.id || user.isAdmin) && (
                  <button
                    onClick={() => onEdit(clip)}
                    className="p-2 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                )}
                {/* Only show delete button for clips uploaded by current user or admins */}
                {(clip.uploadedBy === user.id || user.isAdmin) && (
                  <button
                    onClick={() => onDelete(clip)}
                    className="p-2 text-gray-400 hover:text-red-600 rounded-md hover:bg-red-50"
                    title="Delete clip"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </>
            )}
            <button
              onClick={() => onPlay(clip.id)}
              className="flex items-center gap-2 px-3 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
              <Play className="w-4 h-4" />
              Play
            </button>
          </div>
        </div>

        {/* Quick Info */}
        {clip.metadata.tags.length > 0 && (
          <div className="flex items-center gap-2 mt-2">
            <Tag className="w-3 h-3 text-gray-400" />
            <div className="flex gap-1 flex-wrap">
              {clip.metadata.tags.slice(0, 3).map((tag, tagIndex) => (
                <span
                  key={tagIndex}
                  className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full"
                >
                  {tag}
                </span>
              ))}
              {clip.metadata.tags.length > 3 && (
                <span className="text-xs text-gray-500">
                  +{clip.metadata.tags.length - 3} more
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-gray-200 bg-gray-50">
          {/* Audio Player */}
          {isPlaying && (
            <div className="bg-white rounded-lg p-4 mt-4">
              <AudioPlayer
                key={clip.id}
                url={clip.url}
                title={clip.title}
                showControls={true}
              />
            </div>
          )}

          {/* Metadata */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mt-4">
            <div>
              <h4 className="font-medium text-gray-900 mb-2">
                Speaker Info
              </h4>
              <div className="space-y-1 text-gray-600">
                {clip.metadata.speakerGender && (
                  <div>Gender: {clip.metadata.speakerGender}</div>
                )}
                {clip.metadata.speakerAgeRange && (
                  <div>
                    Age:{" "}
                    {clip.metadata.speakerAgeRange.replace("-", " ")}
                  </div>
                )}
                {clip.metadata.speakerDialect && (
                  <div>Dialect: {clip.metadata.speakerDialect}</div>
                )}
              </div>
            </div>

            <div>
              <h4 className="font-medium text-gray-900 mb-2">
                File Info
              </h4>
              <div className="space-y-1 text-gray-600">
                <div>
                  Size: {(clip.fileSize / 1024).toFixed(1)} KB
                </div>
                <div>Original: {clip.originalFilename}</div>
                <div>Uploaded: {formatDate(clip.createdAt)}</div>
              </div>
            </div>
          </div>

          {clip.metadata.transcript && (
            <div>
              <h4 className="font-medium text-gray-900 mb-2">
                Transcript
              </h4>
              <p className="text-gray-600 bg-white rounded-md p-3">
                &quot;{clip.metadata.transcript}&quot;
              </p>
            </div>
          )}

          {clip.metadata.sourceUrl && (
            <div>
              <h4 className="font-medium text-gray-900 mb-2">
                Source
              </h4>
              <a
                href={clip.metadata.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-600 hover:text-indigo-700 text-sm break-all"
              >
                {clip.metadata.sourceUrl}
              </a>
            </div>
          )}

          {clip.metadata.tags.length > 0 && (
            <div>
              <h4 className="font-medium text-gray-900 mb-2">
                All Tags
              </h4>
              <div className="flex gap-1 flex-wrap">
                {clip.metadata.tags.map((tag, tagIndex) => (
                  <span
                    key={tagIndex}
                    className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
