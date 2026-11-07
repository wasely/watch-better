import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { BrandLogo } from './BrandLogo';

describe('BrandLogo', () => {
  it('always preserves the complete logo frame', () => {
    render(<BrandLogo alt="Watch Better" style={{ objectFit: 'cover' }} />);

    const logo = screen.getByRole('img', { name: 'Watch Better' });
    expect(logo).toHaveStyle({
      objectFit: 'contain',
    });
    expect(logo.getAttribute('src')).toContain('data:image/svg+xml');
  });
});
