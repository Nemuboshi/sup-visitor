import { parseSupFile, parseVobSubFiles } from '../parser';

interface SupRequest {
  readonly type: 'sup';
  readonly data: ArrayBuffer;
}

interface VobSubRequest {
  readonly type: 'vobsub';
  readonly idxText: string;
  readonly subData: ArrayBuffer;
}

interface ErrorResponse {
  readonly type: 'error';
  readonly message: string;
}

type Request = SupRequest | VobSubRequest;

self.onmessage = (event: MessageEvent<Request>) => {
  try {
    const request = event.data;
    const result =
      request.type === 'sup'
        ? parseSupFile(new Uint8Array(request.data))
        : parseVobSubFiles(request.idxText, new Uint8Array(request.subData));
    const transferables: Transferable[] = result.cues.map((cue) => cue.image.pixels.buffer as ArrayBuffer);
    self.postMessage({ type: 'result', result }, { transfer: transferables });
  } catch (error) {
    const response: ErrorResponse = {
      type: 'error',
      message: error instanceof Error ? error.message : 'Unable to parse the subtitle file.',
    };
    self.postMessage(response);
  }
};

export {};
