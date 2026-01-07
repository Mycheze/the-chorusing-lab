"use client";

import { useState } from "react";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import { useAuth } from "@/lib/auth";

interface ClipVotingProps {
  clipId: string;
  upvoteCount: number;
  downvoteCount: number;
  voteScore: number;
  userVote: "up" | "down" | null;
  onVoteUpdate?: (upvotes: number, downvotes: number, score: number, userVote: "up" | "down" | null) => void;
}

export function ClipVoting({
  clipId,
  upvoteCount: initialUpvoteCount,
  downvoteCount: initialDownvoteCount,
  voteScore: initialVoteScore,
  userVote: initialUserVote,
  onVoteUpdate,
}: ClipVotingProps) {
  const { user, getAuthHeaders } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentUpvotes, setCurrentUpvotes] = useState(initialUpvoteCount);
  const [currentDownvotes, setCurrentDownvotes] = useState(initialDownvoteCount);
  const [currentVoteScore, setCurrentVoteScore] = useState(initialVoteScore);
  const [currentUserVote, setCurrentUserVote] = useState<"up" | "down" | null>(initialUserVote);

  const handleVote = async (voteType: "up" | "down") => {
    if (!user) return;

    // If clicking the same vote, remove it
    if (currentUserVote === voteType) {
      await removeVote();
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/clips/${clipId}/vote`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ voteType }),
      });

      if (!response.ok) {
        throw new Error("Failed to submit vote");
      }

      const data = await response.json();
      setCurrentUpvotes(data.upvoteCount);
      setCurrentDownvotes(data.downvoteCount);
      setCurrentVoteScore(data.voteScore);
      setCurrentUserVote(voteType);

      if (onVoteUpdate) {
        onVoteUpdate(data.upvoteCount, data.downvoteCount, data.voteScore, voteType);
      }
    } catch (error) {
      console.error("Failed to submit vote:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const removeVote = async () => {
    if (!user) return;

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/clips/${clipId}/vote`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error("Failed to remove vote");
      }

      const data = await response.json();
      setCurrentUpvotes(data.upvoteCount);
      setCurrentDownvotes(data.downvoteCount);
      setCurrentVoteScore(data.voteScore);
      setCurrentUserVote(null);

      if (onVoteUpdate) {
        onVoteUpdate(data.upvoteCount, data.downvoteCount, data.voteScore, null);
      }
    } catch (error) {
      console.error("Failed to remove vote:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!user) {
    return (
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <ThumbsUp className="w-5 h-5 text-gray-400" />
          <span className="text-sm text-gray-600">{currentUpvotes}</span>
        </div>
        <div className="flex items-center gap-2">
          <ThumbsDown className="w-5 h-5 text-gray-400" />
          <span className="text-sm text-gray-600">{currentDownvotes}</span>
        </div>
        <span className="text-sm font-medium text-gray-700">
          Score: {currentVoteScore > 0 ? "+" : ""}{currentVoteScore}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={() => handleVote("up")}
        disabled={isSubmitting}
        className={`flex items-center gap-2 px-3 py-2 rounded-md transition-colors ${
          currentUserVote === "up"
            ? "bg-green-100 text-green-700 hover:bg-green-200"
            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
        } ${isSubmitting ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
      >
        <ThumbsUp
          className={`w-5 h-5 ${
            currentUserVote === "up" ? "fill-current" : ""
          }`}
        />
        <span className="text-sm font-medium">{currentUpvotes}</span>
      </button>
      <button
        type="button"
        onClick={() => handleVote("down")}
        disabled={isSubmitting}
        className={`flex items-center gap-2 px-3 py-2 rounded-md transition-colors ${
          currentUserVote === "down"
            ? "bg-red-100 text-red-700 hover:bg-red-200"
            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
        } ${isSubmitting ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
      >
        <ThumbsDown
          className={`w-5 h-5 ${
            currentUserVote === "down" ? "fill-current" : ""
          }`}
        />
        <span className="text-sm font-medium">{currentDownvotes}</span>
      </button>
      <span className="text-sm font-medium text-gray-700">
        Score: {currentVoteScore > 0 ? "+" : ""}{currentVoteScore}
      </span>
    </div>
  );
}
