declare module "qrcode" {
  // Minimal types to satisfy TypeScript for the parts we use.
  export function toCanvas(
    canvas: HTMLCanvasElement | string,
    data: string,
    options?: any,
    cb?: (err: Error | null) => void
  ): void;

  const _default: {
    toCanvas: typeof toCanvas;
  };

  export default _default;
}
