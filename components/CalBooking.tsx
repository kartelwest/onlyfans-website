"use client";

import Cal from "@calcom/embed-react";

const calLink = process.env.NEXT_PUBLIC_CAL_LINK;

export default function CalBooking() {
  if (!calLink) {
    return (
      <div className="rounded-2xl border border-[#d8bfc7] bg-[#fffaf7] p-10 text-center">
        <p className="font-semibold text-[#a84f69]">
          Cal.com link not configured
        </p>

        <p className="mt-2 text-sm leading-6 text-[#6e5c63]">
          Set <code className="rounded bg-[#f4e5e8] px-1.5 py-0.5 font-mono text-[#8f3f57]">NEXT_PUBLIC_CAL_LINK</code> to your Cal.com username or event path to show the calendar here.
        </p>
      </div>
    );
  }

  return (
    <Cal
      calLink={calLink}
      config={{ theme: "dark", layout: "month_view" }}
      className="w-full rounded-2xl border border-[#ead8df] bg-white shadow-xl"
      style={{ width: "100%", minHeight: "650px", overflow: "scroll" }}
    />
  );
}
