import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  MIB,
  UPLOAD_ID,
  acceptedOk,
  countOf,
  currentPath,
  dataTransferOf,
  dropOn,
  fileInput,
  makeFile,
  setupApp,
  zone,
} from './helpers';

async function openUpload(routes = {}) {
  const ctx = setupApp('/upload', { 'POST /api/uploads': () => acceptedOk(), ...routes });
  await screen.findByRole('group', { name: 'Drop zone for your drawing' });
  return ctx;
}

describe('DropZone: archivo válido', () => {
  it.each([
    ['image/jpeg', 'a.jpg'],
    ['image/png', 'a.png'],
    ['image/webp', 'a.webp'],
  ])('%s se sube con una llamada y navega a /uploads/<id>', async (type, name) => {
    const { f } = await openUpload();
    dropOn(zone(), [makeFile(type, 1000, name)]);
    await waitFor(() => expect(currentPath()).toBe(`/uploads/${UPLOAD_ID}`));
    expect(countOf(f, 'POST /api/uploads')).toBe(1);
  });

  it('un archivo de exactamente 10 MiB sí se envía', async () => {
    const { f } = await openUpload();
    dropOn(zone(), [makeFile('image/jpeg', 10 * MIB)]);
    await waitFor(() => expect(currentPath()).toBe(`/uploads/${UPLOAD_ID}`));
    expect(countOf(f, 'POST /api/uploads')).toBe(1);
  });

  it('seleccionar con el input (userEvent.upload) también sube', async () => {
    const { f } = await openUpload();
    await userEvent.setup().upload(fileInput(), makeFile('image/png', 500, 'x.png'));
    await waitFor(() => expect(currentPath()).toBe(`/uploads/${UPLOAD_ID}`));
    expect(countOf(f, 'POST /api/uploads')).toBe(1);
  });
});

describe('DropZone: validación del cliente (solo UX), cero fetch', () => {
  it.each([
    ['image/gif', 'a.gif'],
    ['application/pdf', 'a.pdf'],
  ])('tipo %s: mensaje exacto en role=alert y no se sube', async (type, name) => {
    const { f } = await openUpload();
    dropOn(zone(), [makeFile(type, 100, name)]);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Only JPEG, PNG, and WebP files are accepted'
    );
    expect(countOf(f, 'POST /api/uploads')).toBe(0);
    expect(currentPath()).toBe('/upload');
  });

  it('10 MiB + 1 byte: File too large — maximum 10 MB y no se sube', async () => {
    const { f } = await openUpload();
    dropOn(zone(), [makeFile('image/jpeg', 10 * MIB + 1)]);
    expect(await screen.findByRole('alert')).toHaveTextContent('File too large — maximum 10 MB');
    expect(countOf(f, 'POST /api/uploads')).toBe(0);
  });

  it('dos archivos a la vez: Please upload one image at a time y no se sube «el primero»', async () => {
    const { f } = await openUpload();
    dropOn(zone(), [makeFile('image/jpeg', 100, 'a.jpg'), makeFile('image/png', 100, 'b.png')]);
    expect(await screen.findByRole('alert')).toHaveTextContent('Please upload one image at a time');
    expect(countOf(f, 'POST /api/uploads')).toBe(0);
  });

  it('tras un rechazo la zona sigue disponible y un archivo válido la limpia', async () => {
    await openUpload();
    dropOn(zone(), [makeFile('image/gif')]);
    await screen.findByRole('alert');
    dropOn(zone(), [makeFile('image/jpeg')]);
    await waitFor(() => expect(currentPath()).toBe(`/uploads/${UPLOAD_ID}`));
  });
});

describe('DropZone: estado de arrastre y teclado', () => {
  it('al arrastrar sobre la zona dice «Drop to upload»; al salir vuelve al original', async () => {
    await openUpload();
    expect(zone()).toHaveTextContent('Drag your image here, or');
    fireEvent.dragEnter(zone(), { dataTransfer: dataTransferOf([makeFile('image/jpeg')]) });
    await waitFor(() => expect(zone()).toHaveTextContent('Drop to upload'));
    fireEvent.dragLeave(zone(), { dataTransfer: dataTransferOf([makeFile('image/jpeg')]) });
    await waitFor(() => expect(zone()).toHaveTextContent('Drag your image here, or'));
    expect(zone()).not.toHaveTextContent('Drop to upload');
  });

  it('«Browse file» es un button y abre el selector filtrado a imágenes', async () => {
    await openUpload();
    const browse = screen.getByRole('button', { name: 'Browse file' });
    expect(browse.tagName).toBe('BUTTON');
    expect(fileInput().getAttribute('accept')).toBe('image/jpeg,image/png,image/webp');
    expect(fileInput().multiple).toBe(false);
    const click = jest.spyOn(fileInput(), 'click');
    await userEvent.setup().click(browse);
    expect(click).toHaveBeenCalledTimes(1);
  });

  it.each(['{Enter}', ' '])('«Browse file» se activa con el teclado (%j)', async (key) => {
    await openUpload();
    const click = jest.spyOn(fileInput(), 'click');
    const user = userEvent.setup();
    screen.getByRole('button', { name: 'Browse file' }).focus();
    await user.keyboard(key);
    expect(click).toHaveBeenCalledTimes(1);
  });

  it('la zona muestra el formato y el tamaño permitidos', async () => {
    await openUpload();
    expect(zone()).toHaveTextContent('JPEG / PNG / WebP');
    expect(zone()).toHaveTextContent('Max 10 MB');
  });
});
