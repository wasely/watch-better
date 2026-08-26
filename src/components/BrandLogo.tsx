import type { ImgHTMLAttributes } from 'react';

const logoUrl = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><rect width="128" height="128" rx="24" fill="#090d12"/><path d="M43 29v70l61-35z" fill="#3ea6ff"/></svg>',
)}`;

export function BrandLogo({ style, ...props }: ImgHTMLAttributes<HTMLImageElement>) {
  return (
    <img
      alt=""
      draggable={false}
      src={logoUrl}
      {...props}
      style={{ ...style, objectFit: 'contain' }}
    />
  );
}
