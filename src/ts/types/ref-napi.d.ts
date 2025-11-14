declare module 'ref-napi' {
  export function alloc(size: number): Buffer;
  export function alloc(type: string, size: number): Buffer;
}

