declare module "pdfmake/build/vfs_fonts" {
  const vfs: Record<string, string>;
  export default vfs;
}

declare module "pdfmake/js/virtual-fs" {
  interface VirtualFileSystem {
    existsSync(filename: string): boolean;
    readFileSync(filename: string, options?: string | { encoding?: string }): Buffer;
    writeFileSync(filename: string, content: string | Buffer, options?: string | { encoding?: string }): void;
  }
  const virtualfs: VirtualFileSystem;
  export default virtualfs;
}

declare module "pdfmake" {
  interface TDocumentDefinitions {
    pageSize?: "A4" | "A3" | "LETTER" | "LEGAL" | string;
    pageOrientation?: "portrait" | "landscape";
    pageMargins?: [number, number, number, number];
    defaultStyle?: Record<string, unknown>;
    styles?: Record<string, Record<string, unknown>>;
    content: Record<string, unknown>[];
    header?: Record<string, unknown> | (() => Record<string, unknown>);
    footer?: Record<string, unknown> | (() => Record<string, unknown>);
    [key: string]: unknown;
  }

  interface OutputDocument {
    getBuffer(): Promise<Buffer>;
    getBase64(): Promise<string>;
    getDataUrl(): Promise<string>;
    getStream(): Promise<NodeJS.ReadableStream>;
  }

  interface PdfMake {
    createPdf(docDefinition: TDocumentDefinitions, options?: Record<string, unknown>): OutputDocument;
    setFonts(fonts: Record<string, { normal: string | Buffer; bold?: string | Buffer; italics?: string | Buffer; bolditalics?: string | Buffer }>): void;
    addFonts(fonts: Record<string, { normal: string | Buffer; bold?: string | Buffer; italics?: string | Buffer; bolditalics?: string | Buffer }>): void;
    clearFonts(): void;
    setUrlAccessPolicy(callback?: (url: string) => boolean): void;
    setLocalAccessPolicy(callback?: (path: string) => boolean): void;
    setProgressCallback(callback?: (progress: number) => void): void;
    addTableLayouts(layouts: Record<string, unknown>): void;
    setTableLayouts(layouts: Record<string, unknown>): void;
    clearTableLayouts(): void;
  }

  const pdfmake: PdfMake;
  export default pdfmake;
}
