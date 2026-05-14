import { vi } from "vitest";

export enum SymbolKind {
  File = 0,
  Module = 1,
  Namespace = 2,
  Package = 3,
  Class = 4,
  Method = 5,
  Property = 6,
  Field = 7,
  Constructor = 8,
  Enum = 9,
  Interface = 10,
  Function = 11,
  Variable = 12,
  Constant = 13,
  String = 14,
  Number = 15,
  Boolean = 16,
  Array = 17,
  Object = 18,
  Key = 19,
  Null = 20,
  EnumMember = 21,
  Struct = 22,
  Event = 23,
  Operator = 24,
  TypeParameter = 25,
}

export class Position {
  constructor(
    public readonly line: number,
    public readonly character: number
  ) {}
}

export class Range {
  constructor(
    public readonly start: Position,
    public readonly end: Position
  ) {}
}

export class Location {
  public readonly range: Range;
  constructor(
    public readonly uri: Uri,
    positionOrRange: Position | Range
  ) {
    this.range =
      positionOrRange instanceof Range
        ? positionOrRange
        : new Range(positionOrRange, positionOrRange);
  }
}

export class Uri {
  private constructor(
    public readonly scheme: string,
    public readonly fsPath: string
  ) {}

  static file(path: string): Uri {
    return new Uri("file", path);
  }

  toString(): string {
    return `file://${this.fsPath}`;
  }
}

export class SymbolInformation {
  constructor(
    public readonly name: string,
    public readonly kind: SymbolKind,
    public readonly containerName: string,
    public readonly location: Location
  ) {}
}

export const CancellationToken = {
  isCancellationRequested: false,
  onCancellationRequested: vi.fn(),
};

export const workspace = {
  findFiles: vi.fn(),
  createFileSystemWatcher: vi.fn(() => ({
    onDidCreate: vi.fn(),
    onDidChange: vi.fn(),
    onDidDelete: vi.fn(),
    dispose: vi.fn(),
  })),
  fs: {
    stat: vi.fn(),
    readFile: vi.fn(),
  },
};

export const window = {
  createOutputChannel: vi.fn(() => ({
    appendLine: vi.fn(),
    show: vi.fn(),
    dispose: vi.fn(),
  })),
  showInformationMessage: vi.fn(),
  showErrorMessage: vi.fn(),
};

export const languages = {
  registerWorkspaceSymbolProvider: vi.fn(() => ({ dispose: vi.fn() })),
};

export const commands = {
  registerCommand: vi.fn(() => ({ dispose: vi.fn() })),
};

export class EventEmitter<T> {
  private readonly listeners: Array<(e: T) => void> = [];

  readonly event = (listener: (e: T) => void): { dispose: () => void } => {
    this.listeners.push(listener);
    return {
      dispose: () => {
        const idx = this.listeners.indexOf(listener);
        if (idx !== -1) this.listeners.splice(idx, 1);
      },
    };
  };

  fire(data: T): void {
    for (const listener of this.listeners) {
      listener(data);
    }
  }

  dispose(): void {
    this.listeners.length = 0;
  }
}
