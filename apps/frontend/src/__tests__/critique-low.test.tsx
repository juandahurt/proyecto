import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { THUMBNAIL, UPLOAD_ID, currentPath, detailOk, setupApp } from './helpers';

const REASONS = ['low_confidence_flag', 'invalid_schema', 'timeout'] as const;

const open = (reason: string) =>
  setupApp(`/uploads/${UPLOAD_ID}`, {
    [`GET /api/uploads/${UPLOAD_ID}`]: () =>
      detailOk({
        status: 'low_confidence',
        confidence: 'LOW',
        fallbackReason: reason,
        categories: undefined,
      }),
  });

describe('Critique (3B, baja confianza)', () => {
  it.each(REASONS)(
    'con fallbackReason %s muestra el estado «Critique Unavailable»',
    async (reason) => {
      open(reason);
      expect(
        await screen.findByRole('heading', { name: 'Critique Unavailable' })
      ).toBeInTheDocument();
      expect(
        screen.getByText("Estudio couldn't generate a reliable critique for this image.")
      ).toBeInTheDocument();
      expect(screen.getByText('The image may not be a drawing or sketch')).toBeInTheDocument();
      expect(screen.getByText('The image resolution is too low')).toBeInTheDocument();
      expect(
        screen.getByText(
          'The content is outside the expected range (abstract art, digital paintings, etc.)'
        )
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          'This upload counted toward your monthly limit. It will not appear in your trends.'
        )
      ).toBeInTheDocument();
      expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    }
  );

  it.each(REASONS)('con %s no se pinta ninguna categoría ni score', async (reason) => {
    open(reason);
    await screen.findByRole('heading', { name: 'Critique Unavailable' });
    expect(screen.queryByText('Composition')).toBeNull();
    expect(screen.queryByText('COMPOSITION')).toBeNull();
    expect(screen.queryAllByLabelText(/^Score/)).toHaveLength(0);
    expect(screen.queryByRole('heading', { name: 'AI Critique' })).toBeNull();
  });

  it('solo timeout añade «Analysis timed out»', async () => {
    open('timeout');
    await screen.findByRole('heading', { name: 'Critique Unavailable' });
    expect(screen.getByText('Analysis timed out')).toBeInTheDocument();
  });

  it.each(['low_confidence_flag', 'invalid_schema'])(
    '%s no muestra «Analysis timed out»',
    async (reason) => {
      open(reason);
      await screen.findByRole('heading', { name: 'Critique Unavailable' });
      expect(screen.queryByText('Analysis timed out')).toBeNull();
    }
  );

  it('«Try another image» navega a /upload', async () => {
    open('invalid_schema');
    await userEvent.setup().click(await screen.findByRole('link', { name: 'Try another image' }));
    await waitFor(() => expect(currentPath()).toBe('/upload'));
  });

  it('la miniatura válida se sigue pintando en 3B', async () => {
    open('invalid_schema');
    const img = await screen.findByRole('img', { name: 'Uploaded drawing' });
    expect(img).toHaveAttribute('src', THUMBNAIL);
  });
});
