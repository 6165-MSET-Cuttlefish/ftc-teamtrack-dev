/** The card every chart and list on these tabs sits on */
export const cardClass = (isDarkMode: boolean) =>
  `rounded-xl border p-4 sm:p-6 ${isDarkMode ? 'border-team-blue-40 bg-team-dark-20' : 'border-gray-200 bg-white'}`;
