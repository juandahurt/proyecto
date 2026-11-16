import os from 'os';
import fs from 'fs';
import path from 'path';
import { writeBlob } from '../service/blob-store';

describe('writeBlob', () => {
  let tmpDir: string;
  const originalBlobDir = process.env.BLOB_DIR;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ingestion-blob-test-'));
    process.env.BLOB_DIR = tmpDir;
  });

  afterEach(() => {
    // Restaurar BLOB_DIR
    if (originalBlobDir === undefined) {
      delete process.env.BLOB_DIR;
    } else {
      process.env.BLOB_DIR = originalBlobDir;
    }
    // Limpiar tmpDir
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('round-trip: escribe el buffer y se puede leer con fs.readFileSync', async () => {
    const content = Buffer.from('hello world image content');
    const storedFilename = 'test-file.jpg';

    const writtenPath = await writeBlob(storedFilename, content);

    expect(fs.existsSync(writtenPath)).toBe(true);
    const readBack = fs.readFileSync(writtenPath);
    expect(readBack).toEqual(content);
  });

  it('devuelve la ruta absoluta del archivo escrito', async () => {
    const buf = Buffer.from([0xff, 0xd8, 0xff]);
    const storedFilename = 'my-uuid.jpg';

    const result = await writeBlob(storedFilename, buf);

    expect(path.isAbsolute(result)).toBe(true);
    expect(result).toContain(storedFilename);
  });

  it('crea BLOB_DIR si no existe (mkdir -p)', async () => {
    const nestedDir = path.join(tmpDir, 'deep', 'nested', 'path');
    process.env.BLOB_DIR = nestedDir;

    expect(fs.existsSync(nestedDir)).toBe(false);
    await writeBlob('file.jpg', Buffer.from('data'));
    expect(fs.existsSync(nestedDir)).toBe(true);
  });

  it('escribe múltiples archivos en el mismo BLOB_DIR', async () => {
    await writeBlob('file1.jpg', Buffer.from('content1'));
    await writeBlob('file2.png', Buffer.from('content2'));

    const files = fs.readdirSync(tmpDir);
    expect(files).toContain('file1.jpg');
    expect(files).toContain('file2.png');
  });

  it('usa el directorio por defecto cuando BLOB_DIR no está configurado', async () => {
    // Eliminar BLOB_DIR para activar la rama del default
    delete process.env.BLOB_DIR;
    const defaultDir = path.join(process.cwd(), 'data', 'blobs');

    try {
      const result = await writeBlob('default-test.jpg', Buffer.from('default'));
      expect(result).toContain('default-test.jpg');
    } finally {
      // Limpiar el archivo creado en el default dir
      const defaultFile = path.join(defaultDir, 'default-test.jpg');
      if (fs.existsSync(defaultFile)) {
        fs.unlinkSync(defaultFile);
      }
    }
  });
});
