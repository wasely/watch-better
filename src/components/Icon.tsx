import type { ReactNode, SVGProps } from 'react';

export type IconName =
  | 'arrow-left'
  | 'arrow-right'
  | 'captions'
  | 'check'
  | 'chevron-down'
  | 'close'
  | 'copy'
  | 'external'
  | 'expand'
  | 'follow'
  | 'message'
  | 'detach'
  | 'minimize'
  | 'maximize'
  | 'restore'
  | 'search'
  | 'settings'
  | 'spark'
  | 'speed';

const paths: Record<IconName, ReactNode> = {
  'arrow-left': <path d="m14.5 6-6 6 6 6" />,
  'arrow-right': <path d="m9.5 6 6 6-6 6" />,
  captions: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="3" />
      <path d="M7 10h3M14 10h3M7 14h4M14 14h3" />
    </>
  ),
  check: <path d="m5 12 4 4L19 6" />,
  'chevron-down': <path d="m6.5 9.25 5.5 5.5 5.5-5.5" strokeWidth="2.15" />,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  minimize: <path d="M6 17h12" strokeWidth="2.15" />,
  maximize: <rect x="5" y="5" width="14" height="14" rx="2" />,
  restore: (
    <>
      <rect x="4" y="8" width="12" height="12" rx="2" />
      <path d="M8 8V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2" />
    </>
  ),
  copy: (
    <>
      <rect x="8" y="8" width="11" height="11" rx="2" />
      <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
    </>
  ),
  external: (
    <>
      <path d="M14 5h5v5M19 5l-8 8" />
      <path d="M18 13v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
    </>
  ),
  expand: (
    <>
      <path d="M8 4H4v4M16 4h4v4M20 16v4h-4M4 16v4h4" />
      <path d="m4 8 5-5M20 8l-5-5M20 16l-5 5M4 16l5 5" />
    </>
  ),
  follow: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
    </>
  ),
  message: (
    <>
      <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
      <path d="M8 9h8M8 13h5" />
    </>
  ),
  detach: (
    <>
      <rect x="3" y="7" width="12" height="13" rx="2" />
      <path d="M11 4h9v9M20 4l-9 9" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6" />
      <path d="m16 16 4 4" />
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
