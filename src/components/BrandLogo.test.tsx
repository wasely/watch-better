import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { BrandLogo } from './BrandLogo';

describe('BrandLogo', () => {
  it('always preserves the complete logo frame', () => {
    render(<BrandLogo alt="WatchBetter" style={{ objectFit: 'cover' }} />);

    expect(screen.getByRole('img', { name: 'WatchBetter' })).toHaveStyle({
      objectFit: 'contain',
    });
  });
});
