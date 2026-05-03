interface IaiIconProps {
  width?: number;
  height?: number;
}

export default function IaiIcon({ width = 36, height = 42 }: IaiIconProps) {
  return (
    <svg
      viewBox="0 0 82 96"
      xmlns="http://www.w3.org/2000/svg"
      width={width}
      height={height}
      aria-hidden="true"
    >
      <rect x="2" y="2" width="78" height="68" rx="22" fill="#130D22" stroke="#7B4FBF" strokeWidth="1.8" />
      <path d="M14 70 L2 92 L38 70" fill="#130D22" stroke="#7B4FBF" strokeWidth="1.8" strokeLinejoin="round" />
      <circle cx="41" cy="36" r="4.5" fill="#7B4FBF" />
      <path d="M23 24 Q41 12 59 24" fill="none" stroke="#7B4FBF" strokeWidth="1.9" strokeLinecap="round" />
      <path d="M17 32 Q41 16 65 32" fill="none" stroke="#7B4FBF" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M11 42 Q41 22 71 42" fill="none" stroke="#7B4FBF" strokeWidth="1.3" strokeLinecap="round" opacity="0.8" />
      <path d="M7 52 Q41 29 75 52" fill="none" stroke="#7B4FBF" strokeWidth="1.0" strokeLinecap="round" opacity="0.55" />
      <path d="M4 63 Q41 36 78 63" fill="none" stroke="#7B4FBF" strokeWidth="0.75" strokeLinecap="round" opacity="0.3" />
    </svg>
  );
}
