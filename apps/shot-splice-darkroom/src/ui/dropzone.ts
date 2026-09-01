export interface DropzoneHandlers {
  readonly onFiles: (files: FileList) => void;
}

/** Wires a dropzone element for click-to-open, keyboard activation, and drag & drop. */
export function wireDropzone(zone: HTMLElement, fileInput: HTMLInputElement, handlers: DropzoneHandlers): void {
  const openPicker = (): void => fileInput.click();

  zone.addEventListener('click', openPicker);
  zone.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openPicker();
    }
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files && fileInput.files.length > 0) {
      handlers.onFiles(fileInput.files);
    }
    fileInput.value = '';
  });

  let dragDepth = 0;

  zone.addEventListener('dragenter', (event) => {
    event.preventDefault();
    dragDepth += 1;
    zone.classList.add('is-dragover');
  });

  zone.addEventListener('dragover', (event) => {
    event.preventDefault();
  });

  zone.addEventListener('dragleave', () => {
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) {
      zone.classList.remove('is-dragover');
    }
  });

  zone.addEventListener('drop', (event) => {
    event.preventDefault();
    dragDepth = 0;
    zone.classList.remove('is-dragover');
    if (event.dataTransfer?.files.length) {
      handlers.onFiles(event.dataTransfer.files);
    }
  });
}
