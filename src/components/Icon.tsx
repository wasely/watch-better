import type { ReactNode, SVGProps } from 'react';

export type IconName =
  'captions' | 'chevron-down' | 'message' | 'settings' | 'spark' | 'speed';

const paths: Record<IconName, ReactNode> = {
  captions: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="3" />
      <path d="M7 10h3M14 10h3M7 14h4M14 14h3" />
    </>
  ),
  'chevron-down': <path d="m6.5 9.25 5.5 5.5 5.5-5.5" strokeWidth="2.15" />,
  message: (
    <>
      <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
      <path d="M8 9h8M8 13h5" />
    </>
  ),
  settings: (
    <>
      <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
      <circle cx="16" cy="7" r="2" />
      <circle cx="8" cy="17" r="2" />
    </>
  ),
  spark: (
    <path d="m12 2 1.5 5.5L19 9l-5.5 1.5L12 16l-1.5-5.5L5 9l5.5-1.5L12 2ZM5 16l.75 2.25L8 19l-2.25.75L5 22l-.75-2.25L2 19l2.25-.75L5 16Z" />
  ),
  speed: (
    <>
      <path d="M4.9 19a9 9 0 1 1 14.2 0" />
      <path d="m12 12 4-4M8 19h8" />
    </>
  ),
};

export function Icon({
  name,
  ...props
}: { readonly name: IconName } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="18"
      viewBox="0 0 24 24"
      width="18"
      {...props}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.75"
    >
      {paths[name]}
    </svg>
  );
}
