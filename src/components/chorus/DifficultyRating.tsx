"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { useAuth } from "@/lib/auth";

interface DifficultyRatingProps {
  clipId: string;
  averageRating: number | null;
  ratingCount: number;
  userRating: number | null;
  onRatingUpdate?: (rating: number | null, average: number | null, count: number) => void;
}

export function DifficultyRating({
  clipId,
  averageRating,
  ratingCount,
  userRating,
  onRatingUpdate,
}: DifficultyRatingProps) {
  const { user, getAuthHeaders } = useAuth();
  const [hoveredRating, setHoveredRating] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentAverage, setCurrentAverage] = useState<number | null>(averageRating);
  const [currentCount, setCurrentCount] = useState(ratingCount);
  const [currentUserRating, setCurrentUserRating] = useState<number | null>(userRating);

  const handleRatingClick = async (rating: number) => {
    if (!user) return;

    // If clicking the same rating, remove it
    if (currentUserRating === rating) {
      await removeRating();
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/clips/${clipId}/difficulty`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ rating }),
      });

      if (!response.ok) {
        throw new Error("Failed to submit rating");
      }

      const data = await response.json();
      setCurrentAverage(data.rating);
      setCurrentCount(data.count);
      setCurrentUserRating(rating);

      if (onRatingUpdate) {
        onRatingUpdate(rating, data.rating, data.count);
      }
    } catch (error) {
      console.error("Failed to submit rating:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const removeRating = async () => {
    if (!user) return;

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/clips/${clipId}/difficulty`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error("Failed to remove rating");
      }

      const data = await response.json();
      setCurrentAverage(data.rating);
      setCurrentCount(data.count);
      setCurrentUserRating(null);

      if (onRatingUpdate) {
        onRatingUpdate(null, data.rating, data.count);
      }
    } catch (error) {
      console.error("Failed to remove rating:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const displayRating = hoveredRating !== null ? hoveredRating : currentAverage;

  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <Star
              key={star}
              className="w-5 h-5 text-gray-300"
              fill="currentColor"
            />
          ))}
        </div>
        {currentAverage !== null && (
          <span className="text-sm text-gray-600">
            {currentAverage.toFixed(1)} ({currentCount} {currentCount === 1 ? "rating" : "ratings"})
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((star) => {
            const isActive =
              displayRating !== null && star <= Math.round(displayRating);
            const isUserRating = currentUserRating === star;

            return (
              <button
                key={star}
                type="button"
                onClick={() => handleRatingClick(star)}
                onMouseEnter={() => setHoveredRating(star)}
                onMouseLeave={() => setHoveredRating(null)}
                disabled={isSubmitting}
                className={`transition-colors ${
                  isSubmitting ? "cursor-not-allowed opacity-50" : "cursor-pointer"
                }`}
                title={
                  star === 1
                    ? "Beginner"
                    : star === 3
                    ? "Intermediate"
                    : star === 5
                    ? "Advanced"
                    : ""
                }
              >
                <Star
                  className={`w-5 h-5 ${
                    isActive
                      ? isUserRating
                        ? "text-yellow-500"
                        : "text-yellow-400"
                      : "text-gray-300"
                  }`}
                  fill={isActive ? "currentColor" : "none"}
                />
              </button>
            );
          })}
        </div>
        {currentAverage !== null && (
          <span className="text-sm text-gray-600">
            {currentAverage.toFixed(1)} ({currentCount} {currentCount === 1 ? "rating" : "ratings"})
          </span>
        )}
        {currentAverage === null && currentCount === 0 && (
          <span className="text-sm text-gray-500">No ratings yet</span>
        )}
      </div>
      <div className="text-xs text-gray-500">
        1 = Beginner • 3 = Intermediate • 5 = Advanced
      </div>
    </div>
  );
}
