import { useState } from "react";

export const Notes = () => {
  const [notes, setNotes] = useState("");

  return (
    <div className="space-y-6">
      <h2 className="text-team-blue text-2xl font-semibold leading-6">Notes</h2>

      <div className="flex gap-6">
        <div className="flex flex-col gap-2 w-full sm:max-w-[519px]">
          <label className="text-white text-base leading-6">
            Performance Notes & Observations
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Describe any major mistakes"
            className="px-2.5 py-2.5 rounded border border-team-blue-40 bg-team-dark text-white text-base font-normal leading-6 focus:outline-none focus:border-team-blue focus:ring-1 focus:ring-team-blue placeholder:text-team-white-40 resize-none"
            rows={4}
          />
        </div>
      </div>
    </div>
  );
};
