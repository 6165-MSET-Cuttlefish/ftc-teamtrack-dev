import { Search, Sun, Settings } from "lucide-react";
import { useTheme } from "../contexts/ThemeContext";

const TeamTrackLogo = () => {
  const { isDarkMode } = useTheme();
  return (
    <div className="flex items-center gap-6">
      <div className="flex items-center gap-2.5">
        <svg
          width="8"
          height="20"
          viewBox="0 0 8 20"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-2 h-5"
        >
          <path
            d="M3.9994 0.645596L7.60709 6.46935H0.464233L3.9994 0.645596Z"
            fill="#B0E5FE"
          />
          <path
            d="M4.00005 9.38123L0.392909 7.23372H7.53577L4.00005 9.38123Z"
            fill="#B0E5FE"
          />
          <path
            d="M0.321429 2.31992L3.28571 0.5L0 6.06897L0.321429 2.31992Z"
            fill="#B0E5FE"
          />
          <path
            d="M7.67857 2.31992L4.71429 0.5L8 6.06897L7.67857 2.31992Z"
            fill="#B0E5FE"
          />
          <path
            d="M0.392822 9.24855C0.392822 8.74891 0.92601 8.43006 1.36618 8.66649C1.58053 8.78162 1.71425 9.00524 1.71425 9.24855V18.3817C1.71425 18.6225 1.58325 18.8442 1.37235 18.9604C0.932001 19.203 0.392822 18.8844 0.392822 18.3817V9.24855Z"
            fill="#B0E5FE"
          />
          <path
            d="M2.3681 10.2849C2.37112 9.76044 2.94632 9.44078 3.39332 9.71519C3.59274 9.83762 3.71427 10.0548 3.71427 10.2888V17.1858C3.71427 17.4334 3.58216 17.6622 3.36771 17.786C2.9042 18.0535 2.32529 17.717 2.32837 17.1818L2.3681 10.2849Z"
            fill="#B0E5FE"
          />
          <path
            d="M7.53577 9.26287C7.53577 8.75993 6.9962 8.4414 6.55585 8.68437C6.34516 8.80063 6.21434 9.02223 6.21434 9.26287V18.4077C6.21434 18.6534 6.35068 18.8788 6.5683 18.9929C7.00823 19.2235 7.53577 18.9044 7.53577 18.4077V9.26287Z"
            fill="#B0E5FE"
          />
          <path
            d="M5.6319 10.2849C5.62888 9.76044 5.05368 9.44078 4.60668 9.71519C4.40726 9.83762 4.28573 10.0548 4.28573 10.2888V17.1858C4.28573 17.4334 4.41784 17.6622 4.63229 17.786C5.0958 18.0535 5.67471 17.717 5.67163 17.1818L5.6319 10.2849Z"
            fill="#B0E5FE"
          />
        </svg>
        <span
          className={`font-montserrat italic text-xs leading-6 relative -top-1.5 ${isDarkMode ? "text-white" : "text-[#191919]"}`}
        >
          <span>Team</span>
          <span>Track</span>
        </span>
      </div>
    </div>
  );
};

const SearchBox = () => {
  const { isDarkMode } = useTheme();
  return (
    <div className="flex items-center gap-3 px-12 py-3.5 rounded-2xl bg-transparent border border-team-white-20">
      <Search className="w-4 h-4 text-team-blue-40" />
      <span className="text-team-blue-40 text-base font-medium">Search</span>
    </div>
  );
};

const NavigationMenu = () => {
  const { isDarkMode, toggleTheme } = useTheme();
  return (
    <div className="flex items-center gap-2.5 px-2.5 py-2.5 rounded-2xl border border-team-white-20 bg-team-dark-20">
      <span
        className={`text-base px-2 ${isDarkMode ? "text-white" : "text-[#191919]"}`}
      >
        Learn
      </span>
      <span
        className={`text-base px-2 ${isDarkMode ? "text-white" : "text-[#191919]"}`}
      >
        Community
      </span>
      <span
        className={`text-base px-2 ${isDarkMode ? "text-white" : "text-[#191919]"}`}
      >
        About Us
      </span>
      <div className="w-4 h-4 bg-team-blue rounded-full flex items-center justify-center ml-2">
        <div className="w-2 h-2 bg-team-dark rounded-full"></div>
      </div>
      <button
        onClick={toggleTheme}
        className={`ml-1 hover:opacity-80 transition-opacity ${isDarkMode ? "text-white" : "text-[#191919]"}`}
      >
        <Sun className="w-4 h-4" />
      </button>
      <Settings
        className={`w-4 h-4 ml-1 ${isDarkMode ? "text-white" : "text-[#191919]"}`}
      />
    </div>
  );
};

export const Header = () => {
  const { isDarkMode } = useTheme();
  return (
    <header
      className={`w-full px-4 sm:px-8 py-4 flex flex-col sm:flex-row justify-between items-center gap-4 sm:gap-0 border-b border-team-white-20 ${isDarkMode ? "bg-transparent" : "bg-white"}`}
    >
      <div className="flex items-center w-full sm:w-80">
        <TeamTrackLogo />
      </div>

      <div className="hidden lg:flex items-center w-80">
        <SearchBox />
      </div>

      <div className="flex items-center w-full sm:w-80 justify-center sm:justify-end">
        <NavigationMenu />
      </div>
    </header>
  );
};
