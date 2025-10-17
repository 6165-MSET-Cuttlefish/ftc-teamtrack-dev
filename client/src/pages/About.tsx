import React from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';

const About: React.FC = () => {
  const { isDarkMode } = useTheme();
  return (
    <div className={`min-h-screen ${isDarkMode ? 'bg-team-dark' : 'bg-[#FEFEFE]'}`}>
      <div className="max-w-[800px] mx-auto px-4 sm:px-8 py-12 lg:py-20">
        <h1 className="text-team-blue text-3xl lg:text-5xl font-semibold mb-4">About Us</h1>
        <p className={`text-base leading-7 ${isDarkMode ? 'text-white' : 'text-[#191919]'}`}>
          TeamTrack helps teams capture and analyze practice session performance.
          This page describes the team, mission, and how TeamTrack works.
        </p>
        <div className="mt-8 space-y-4">
          <h2 className="text-xl font-semibold">Our Mission</h2>
          <p className={isDarkMode ? 'text-team-white-60' : 'text-team-blue-40'}>
            Make data-driven practice simple and actionable for every team.
          </p>
        </div>
        <div className="mt-8">
          <Link to="/" className="text-team-blue underline">Back home</Link>
        </div>
      </div>
    </div>
  );
};

export default About;
