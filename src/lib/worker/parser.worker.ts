import { encodeSup } from '../export/sup';
import type { SubtitleCue } from '../model/cue';
import { parseSupCues, parseVobSubCues } from '../parser';

interface ParseSupRequest {
  readonly type: 'sup';
  readonly data: ArrayBuffer;
}

interface ParseVobSubRequest {
  readonly type: 'vobsub';
  readonly idxText: string;
  readonly subData: ArrayBuffer;
}

interface ExportRequest {
  readonly type: 'export-sup';
  readonly cues: readonly SubtitleCue[];
}

interface ErrorResponse {
  readonly type: 'error';
  readonly message: string;
}

type Request = ParseSupRequest | ParseVobSubRequest | ExportRequest;

self.onmessage = (event: MessageEvent<Request>) => {
  try {
    const request = event.data;
    if (request.type === 'export-sup') {
      const data = encodeSup(request.cues);
      self.postMessage({ type: 'export-result', data: data.buffer }, { transfer: [data.buffer] });
      return;
    }
    const cues =
      request.type === 'sup'
        ? parseSupCues(new Uint8Array(request.data))
        : parseVobSubCues(request.idxText, new Uint8Array(request.subData));
    const transferables: Transferable[] = cues.map((cue) => cue.image.pixels.buffer);
    self.postMessage({ type: 'result', format: request.type, cues }, { transfer: transferables });
  } catch (error) {
    const response: ErrorResponse = {
      type: 'error',
      message: error instanceof Error ? error.message : 'Unable to parse or export the subtitle file.',
    };
    self.postMessage(response);
  }
};

export {};
