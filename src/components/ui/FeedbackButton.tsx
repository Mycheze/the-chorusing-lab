"use client";

import { MessageSquare } from "lucide-react";

const FEEDBACK_FORM_URL = "https://forms.gle/piDPZewWfuzJU3xM8";

export function FeedbackButton() {
  const handleFeedbackClick = () => {
    window.open(FEEDBACK_FORM_URL, "_blank", "noopener,noreferrer");
  };

  return (
    <button
      onClick={handleFeedbackClick}
      className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-2 py-2 lg:px-4 lg:py-3 bg-indigo-600 text-white rounded-full shadow-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors text-xs lg:text-sm"
      aria-label="Provide feedback"
      title="Share your feedback"
    >
      <MessageSquare className="w-4 h-4 lg:w-5 lg:h-5" />
      <span className="hidden lg:inline font-medium">Feedback</span>
    </button>
  );
}
