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
      className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 bg-indigo-600 text-white rounded-full shadow-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors"
      aria-label="Provide feedback"
      title="Share your feedback"
    >
      <MessageSquare className="w-5 h-5" />
      <span className="font-medium">Feedback</span>
    </button>
  );
}
