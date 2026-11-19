import { useDropzone, type FileRejection } from 'react-dropzone';
import { cn } from '../lib/utils';
import { Button } from './ui/button';

/** Mismo tope que `MAX_UPLOAD_BYTES` del servidor (10 MiB). El servidor sigue siendo la autoridad. */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export const MSG_BAD_TYPE = 'Only JPEG, PNG, and WebP files are accepted';
export const MSG_TOO_LARGE = 'File too large — maximum 10 MB';
export const MSG_ONE_AT_A_TIME = 'Please upload one image at a time';

const ACCEPT = { 'image/jpeg': [], 'image/png': [], 'image/webp': [] };

function rejectionMessage(rejections: FileRejection[]): string {
  const codes = rejections.flatMap((r) => r.errors.map((e) => e.code));
  if (codes.includes('too-many-files')) return MSG_ONE_AT_A_TIME;
  if (codes.includes('file-too-large')) return MSG_TOO_LARGE;
  return MSG_BAD_TYPE;
}

interface Props {
  onFile: (file: File) => void;
  onReject: (message: string) => void;
}

/**
 * Zona de arrastre (pantalla 2A). La validación del cliente es solo UX: tipo y tamaño. Nunca lee
 * ni muestra el nombre del archivo.
 */
export function DropZone({ onFile, onReject }: Props) {
  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    accept: ACCEPT,
    maxSize: MAX_UPLOAD_BYTES,
    multiple: false,
    noClick: true,
    noKeyboard: true,
    onDrop: (accepted, rejections) => {
      if (rejections.length > 0) {
        onReject(rejectionMessage(rejections));
        return;
      }
      if (accepted.length === 1) onFile(accepted[0]);
    },
  });

  return (
    <div
      {...getRootProps({
        role: 'group',
        tabIndex: 0,
        'aria-label': 'Drop zone for your drawing',
        className: cn(
          'flex flex-col items-center gap-4 rounded-lg border-2 border-dashed border-gray-200 bg-white p-10 text-center',
          isDragActive && 'border-blue-600 bg-blue-50'
        ),
      })}
    >
      <label htmlFor="drawing-file" className="sr-only">
        Choose an image to upload
      </label>
      <input id="drawing-file" {...getInputProps()} />
      <p className="text-base text-gray-900">
        {isDragActive ? 'Drop to upload' : 'Drag your image here, or'}
      </p>
      <Button type="button" onClick={open}>
        Browse file
      </Button>
      <p className="text-sm text-gray-500">JPEG / PNG / WebP | Max 10 MB</p>
    </div>
  );
}
