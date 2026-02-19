import { useTheme, useSession } from '@/contexts';

export const Notes = () => {
  const { isDarkMode } = useTheme();
  const { sessionData, updateSessionData } = useSession();

  return (
    <div className="space-y-6">
      <h2 className="text-team-blue text-2xl font-semibold leading-6">Session Notes</h2>

      <div className="flex gap-6">
        <div className="flex flex-col gap-2 w-full sm:max-w-2xl">
          <label
            className={`text-base leading-6 ${isDarkMode ? 'text-white' : 'text-black'}`}
          >
            Performance Notes & Observations
          </label>
          <textarea
            value={sessionData.notes ?? ''}
            onChange={e => updateSessionData({ notes: e.target.value })}
            placeholder="Describe any major mistakes"
            className={`px-2.5 py-2.5 rounded border border-team-blue-40 text-base font-normal leading-6 focus:outline-none focus:border-team-blue focus:ring-1 focus:ring-team-blue placeholder:text-team-white-40 resize-none ${isDarkMode ? 'bg-team-dark text-white' : 'bg-[#FEFEFE] text-black'}`}
            rows={4}
          />
        </div>
      </div>
    </div>
  );
};
