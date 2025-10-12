interface LogoProps {
  className?: string;
  width?: number;
  height?: number;
}

export const TeamLogo = ({ className = "", width = 32, height = 32 }: LogoProps) => {
  return (
    <svg 
      width={width} 
      height={height} 
      viewBox="0 0 100 100" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Top pyramid faces */}
      <path 
        d="M15 35 L50 5 L85 35 L75 40 L50 20 L25 40 Z" 
        fill="currentColor"
      />
      
      {/* Middle diamond section */}
      <path 
        d="M20 40 L50 30 L80 40 L50 50 Z" 
        fill="currentColor"
      />
      
      {/* Vertical pillars/columns */}
      <rect x="25" y="50" width="10" height="40" fill="currentColor" />
      <rect x="45" y="50" width="10" height="40" fill="currentColor" />
      <rect x="65" y="50" width="10" height="40" fill="currentColor" />
      
      {/* Bottom connecting element */}
      <path 
        d="M20 85 L50 75 L80 85 L80 95 L20 95 Z" 
        fill="currentColor"
      />
    </svg>
  );
};