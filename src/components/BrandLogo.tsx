import type { ImgHTMLAttributes } from 'react';

const logoUrl = new URL('../assets/watchbetter-logo.png', import.meta.url).href;

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
